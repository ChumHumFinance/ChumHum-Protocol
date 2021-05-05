pragma solidity ^0.5.16;

import "./CToken.sol";
import "./PriceOracle.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./BUMControllerStorage.sol";
import "./BUMUnitroller.sol";
import "./BUM/BUM.sol";

interface ComptrollerImplInterface {
    function protocolPaused() external view returns (bool);
    function mintedBUMs(address account) external view returns (uint);
    function bumMintRate() external view returns (uint);
    function chumhumBUMRate() external view returns (uint);
    function chumhumAccrued(address account) external view returns(uint);
    function getAssetsIn(address account) external view returns (CToken[] memory);
    function oracle() external view returns (PriceOracle);

    function distributeBUMMinterChumHum(address bumMinter) external;
}

/**
 * @title ChumHum's BUM Comptroller Contract
 * @author ChumHum
 */
contract BUMController is BUMControllerStorageG2, BUMControllerErrorReporter, Exponential {

    /// @notice Emitted when Comptroller is changed
    event NewComptroller(ComptrollerInterface oldComptroller, ComptrollerInterface newComptroller);

    /**
     * @notice Event emitted when BUM is minted
     */
    event MintBUM(address minter, uint mintBUMAmount);

    /**
     * @notice Event emitted when BUM is repaid
     */
    event RepayBUM(address payer, address borrower, uint repayBUMAmount);

    /// @notice The initial ChumHum index for a market
    uint224 public constant chumhumInitialIndex = 1e36;

    /**
     * @notice Event emitted when a borrow is liquidated
     */
    event LiquidateBUM(address liquidator, address borrower, uint repayAmount, address cTokenCollateral, uint seizeTokens);

    /**
     * @notice Emitted when treasury guardian is changed
     */
    event NewTreasuryGuardian(address oldTreasuryGuardian, address newTreasuryGuardian);

    /**
     * @notice Emitted when treasury address is changed
     */
    event NewTreasuryAddress(address oldTreasuryAddress, address newTreasuryAddress);

    /**
     * @notice Emitted when treasury percent is changed
     */
    event NewTreasuryPercent(uint oldTreasuryPercent, uint newTreasuryPercent);

    /**
     * @notice Event emitted when BUMs are minted and fee are transferred
     */
    event MintFee(address minter, uint feeAmount);

    /*** Main Actions ***/
    struct MintLocalVars {
        Error err;
        MathError mathErr;
        uint mintAmount;
    }

    function mintBUM(uint mintBUMAmount) external nonReentrant returns (uint) {
        if(address(comptroller) != address(0)) {
            require(mintBUMAmount > 0, "mintBUMAmount cannt be zero");

            require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            MintLocalVars memory vars;

            address minter = msg.sender;

            // Keep the flywheel moving
            updateChumHumBUMMintIndex();
            ComptrollerImplInterface(address(comptroller)).distributeBUMMinterChumHum(minter);

            uint oErr;
            MathError mErr;
            uint accountMintBUMNew;
            uint accountMintableBUM;

            (oErr, accountMintableBUM) = getMintableBUM(minter);
            if (oErr != uint(Error.NO_ERROR)) {
                return uint(Error.REJECTION);
            }

            // check that user have sufficient mintableBUM balance
            if (mintBUMAmount > accountMintableBUM) {
                return fail(Error.REJECTION, FailureInfo.BUM_MINT_REJECTION);
            }

            (mErr, accountMintBUMNew) = addUInt(ComptrollerImplInterface(address(comptroller)).mintedBUMs(minter), mintBUMAmount);
            require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");
            uint error = comptroller.setMintedBUMOf(minter, accountMintBUMNew);
            if (error != 0 ) {
                return error;
            }

            uint feeAmount;
            uint remainedAmount;
            vars.mintAmount = mintBUMAmount;
            if (treasuryPercent != 0) {
                (vars.mathErr, feeAmount) = mulUInt(vars.mintAmount, treasuryPercent);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                (vars.mathErr, feeAmount) = divUInt(feeAmount, 1e18);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                (vars.mathErr, remainedAmount) = subUInt(vars.mintAmount, feeAmount);
                if (vars.mathErr != MathError.NO_ERROR) {
                    return failOpaque(Error.MATH_ERROR, FailureInfo.MINT_FEE_CALCULATION_FAILED, uint(vars.mathErr));
                }

                BUM(getBUMAddress()).mint(treasuryAddress, feeAmount);

                emit MintFee(minter, feeAmount);
            } else {
                remainedAmount = vars.mintAmount;
            }

            BUM(getBUMAddress()).mint(minter, remainedAmount);

            emit MintBUM(minter, remainedAmount);

            return uint(Error.NO_ERROR);
        }
    }

    /**
     * @notice Repay BUM
     */
    function repayBUM(uint repayBUMAmount) external nonReentrant returns (uint, uint) {
        if(address(comptroller) != address(0)) {
            require(repayBUMAmount > 0, "repayBUMAmount cannt be zero");

            require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address payer = msg.sender;

            updateChumHumBUMMintIndex();
            ComptrollerImplInterface(address(comptroller)).distributeBUMMinterChumHum(payer);

            return repayBUMFresh(msg.sender, msg.sender, repayBUMAmount);
        }
    }

    /**
     * @notice Repay BUM Internal
     * @notice Borrowed BUMs are repaid by another user (possibly the borrower).
     * @param payer the account paying off the BUM
     * @param borrower the account with the debt being payed off
     * @param repayAmount the amount of BUM being returned
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment amount.
     */
    function repayBUMFresh(address payer, address borrower, uint repayAmount) internal returns (uint, uint) {
        uint actualBurnAmount;

        uint bumBalanceBorrower = ComptrollerImplInterface(address(comptroller)).mintedBUMs(borrower);

        if(bumBalanceBorrower > repayAmount) {
            actualBurnAmount = repayAmount;
        } else {
            actualBurnAmount = bumBalanceBorrower;
        }

        MathError mErr;
        uint accountBUMNew;

        BUM(getBUMAddress()).burn(payer, actualBurnAmount);

        (mErr, accountBUMNew) = subUInt(bumBalanceBorrower, actualBurnAmount);
        require(mErr == MathError.NO_ERROR, "BUM_BURN_AMOUNT_CALCULATION_FAILED");

        uint error = comptroller.setMintedBUMOf(borrower, accountBUMNew);
        if (error != 0) {
            return (error, 0);
        }
        emit RepayBUM(payer, borrower, actualBurnAmount);

        return (uint(Error.NO_ERROR), actualBurnAmount);
    }

    /**
     * @notice The sender liquidates the bum minters collateral.
     *  The collateral seized is transferred to the liquidator.
     * @param borrower The borrower of bum to be liquidated
     * @param cTokenCollateral The market in which to seize collateral from the borrower
     * @param repayAmount The amount of the underlying borrowed asset to repay
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment amount.
     */
    function liquidateBUM(address borrower, uint repayAmount, CTokenInterface cTokenCollateral) external nonReentrant returns (uint, uint) {
        require(!ComptrollerImplInterface(address(comptroller)).protocolPaused(), "protocol is paused");

        uint error = cTokenCollateral.accrueInterest();
        if (error != uint(Error.NO_ERROR)) {
            // accrueInterest emits logs on errors, but we still want to log the fact that an attempted liquidation failed
            return (fail(Error(error), FailureInfo.BUM_LIQUIDATE_ACCRUE_COLLATERAL_INTEREST_FAILED), 0);
        }

        // liquidateBUMFresh emits borrow-specific logs on errors, so we don't need to
        return liquidateBUMFresh(msg.sender, borrower, repayAmount, cTokenCollateral);
    }

    /**
     * @notice The liquidator liquidates the borrowers collateral by repay borrowers BUM.
     *  The collateral seized is transferred to the liquidator.
     * @param liquidator The address repaying the BUM and seizing collateral
     * @param borrower The borrower of this BUM to be liquidated
     * @param cTokenCollateral The market in which to seize collateral from the borrower
     * @param repayAmount The amount of the BUM to repay
     * @return (uint, uint) An error code (0=success, otherwise a failure, see ErrorReporter.sol), and the actual repayment BUM.
     */
    function liquidateBUMFresh(address liquidator, address borrower, uint repayAmount, CTokenInterface cTokenCollateral) internal returns (uint, uint) {
        if(address(comptroller) != address(0)) {
            /* Fail if liquidate not allowed */
            uint allowed = comptroller.liquidateBorrowAllowed(address(this), address(cTokenCollateral), liquidator, borrower, repayAmount);
            if (allowed != 0) {
                return (failOpaque(Error.REJECTION, FailureInfo.BUM_LIQUIDATE_COMPTROLLER_REJECTION, allowed), 0);
            }

            /* Verify cTokenCollateral market's block number equals current block number */
            //if (cTokenCollateral.accrualBlockNumber() != accrualBlockNumber) {
            if (cTokenCollateral.accrualBlockNumber() != getBlockNumber()) {
                return (fail(Error.REJECTION, FailureInfo.BUM_LIQUIDATE_COLLATERAL_FRESHNESS_CHECK), 0);
            }

            /* Fail if borrower = liquidator */
            if (borrower == liquidator) {
                return (fail(Error.REJECTION, FailureInfo.BUM_LIQUIDATE_LIQUIDATOR_IS_BORROWER), 0);
            }

            /* Fail if repayAmount = 0 */
            if (repayAmount == 0) {
                return (fail(Error.REJECTION, FailureInfo.BUM_LIQUIDATE_CLOSE_AMOUNT_IS_ZERO), 0);
            }

            /* Fail if repayAmount = -1 */
            if (repayAmount == uint(-1)) {
                return (fail(Error.REJECTION, FailureInfo.BUM_LIQUIDATE_CLOSE_AMOUNT_IS_UINT_MAX), 0);
            }


            /* Fail if repayBUM fails */
            (uint repayBorrowError, uint actualRepayAmount) = repayBUMFresh(liquidator, borrower, repayAmount);
            if (repayBorrowError != uint(Error.NO_ERROR)) {
                return (fail(Error(repayBorrowError), FailureInfo.BUM_LIQUIDATE_REPAY_BORROW_FRESH_FAILED), 0);
            }

            /////////////////////////
            // EFFECTS & INTERACTIONS
            // (No safe failures beyond this point)

            /* We calculate the number of collateral tokens that will be seized */
            (uint amountSeizeError, uint seizeTokens) = comptroller.liquidateBUMCalculateSeizeTokens(address(cTokenCollateral), actualRepayAmount);
            require(amountSeizeError == uint(Error.NO_ERROR), "BUM_LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED");

            /* Revert if borrower collateral token balance < seizeTokens */
            require(cTokenCollateral.balanceOf(borrower) >= seizeTokens, "BUM_LIQUIDATE_SEIZE_TOO_MUCH");

            uint seizeError;
            seizeError = cTokenCollateral.seize(liquidator, borrower, seizeTokens);

            /* Revert if seize tokens fails (since we cannot be sure of side effects) */
            require(seizeError == uint(Error.NO_ERROR), "token seizure failed");

            /* We emit a LiquidateBorrow event */
            emit LiquidateBUM(liquidator, borrower, actualRepayAmount, address(cTokenCollateral), seizeTokens);

            /* We call the defense hook */
            comptroller.liquidateBorrowVerify(address(this), address(cTokenCollateral), liquidator, borrower, actualRepayAmount, seizeTokens);

            return (uint(Error.NO_ERROR), actualRepayAmount);
        }
    }

    /**
     * @notice Initialize the ChumHumBUMState
     */
    function _initializeChumHumBUMState(uint blockNumber) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        if (isChumHumBUMInitialized == false) {
            isChumHumBUMInitialized = true;
            uint bumBlockNumber = blockNumber == 0 ? getBlockNumber() : blockNumber;
            chumhumBUMState = ChumHumBUMState({
                index: chumhumInitialIndex,
                block: safe32(bumBlockNumber, "block number overflows")
            });
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Accrue CHUM to by updating the BUM minter index
     */
    function updateChumHumBUMMintIndex() public returns (uint) {
        uint bumMinterSpeed = ComptrollerImplInterface(address(comptroller)).chumhumBUMRate();
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(chumhumBUMState.block));
        if (deltaBlocks > 0 && bumMinterSpeed > 0) {
            uint bumAmount = BUM(getBUMAddress()).totalSupply();
            uint chumhumAccrued = mul_(deltaBlocks, bumMinterSpeed);
            Double memory ratio = bumAmount > 0 ? fraction(chumhumAccrued, bumAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: chumhumBUMState.index}), ratio);
            chumhumBUMState = ChumHumBUMState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            chumhumBUMState.block = safe32(blockNumber, "block number overflows");
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Calculate CHUM accrued by a BUM minter
     * @param bumMinter The address of the BUM minter to distribute CHUM to
     */
    function calcDistributeBUMMinterChumHum(address bumMinter) public returns(uint, uint, uint, uint) {
        // Check caller is comptroller
        if (msg.sender != address(comptroller)) {
            return (fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK), 0, 0, 0);
        }

        Double memory bumMintIndex = Double({mantissa: chumhumBUMState.index});
        Double memory bumMinterIndex = Double({mantissa: chumhumBUMMinterIndex[bumMinter]});
        chumhumBUMMinterIndex[bumMinter] = bumMintIndex.mantissa;

        if (bumMinterIndex.mantissa == 0 && bumMintIndex.mantissa > 0) {
            bumMinterIndex.mantissa = chumhumInitialIndex;
        }

        Double memory deltaIndex = sub_(bumMintIndex, bumMinterIndex);
        uint bumMinterAmount = ComptrollerImplInterface(address(comptroller)).mintedBUMs(bumMinter);
        uint bumMinterDelta = mul_(bumMinterAmount, deltaIndex);
        uint bumMinterAccrued = add_(ComptrollerImplInterface(address(comptroller)).chumhumAccrued(bumMinter), bumMinterDelta);
        return (uint(Error.NO_ERROR), bumMinterAccrued, bumMinterDelta, bumMintIndex.mantissa);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new comptroller
      * @dev Admin function to set a new comptroller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setComptroller(ComptrollerInterface comptroller_) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        ComptrollerInterface oldComptroller = comptroller;
        comptroller = comptroller_;
        emit NewComptroller(oldComptroller, comptroller_);

        return uint(Error.NO_ERROR);
    }

    function _become(BUMUnitroller unitroller) external {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        require(unitroller._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account total supply balance.
     *  Note that `cTokenBalance` is the number of cTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountAmountLocalVars {
        uint totalSupplyAmount;
        uint sumSupply;
        uint sumBorrowPlusEffects;
        uint cTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    function getMintableBUM(address minter) public view returns (uint, uint) {
        PriceOracle oracle = ComptrollerImplInterface(address(comptroller)).oracle();
        CToken[] memory enteredMarkets = ComptrollerImplInterface(address(comptroller)).getAssetsIn(minter);

        AccountAmountLocalVars memory vars; // Holds all our calculation results

        uint oErr;
        MathError mErr;

        uint accountMintableBUM;
        uint i;

        /**
         * We use this formula to calculate mintable BUM amount.
         * totalSupplyAmount * BUMMintRate - (totalBorrowAmount + mintedBUMOf)
         */
        for (i = 0; i < enteredMarkets.length; i++) {
            (oErr, vars.cTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = enteredMarkets[i].getAccountSnapshot(minter);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (uint(Error.SNAPSHOT_ERROR), 0);
            }
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(enteredMarkets[i]);
            if (vars.oraclePriceMantissa == 0) {
                return (uint(Error.PRICE_ERROR), 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            (mErr, vars.tokensToDenom) = mulExp(vars.exchangeRate, vars.oraclePrice);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumSupply += tokensToDenom * cTokenBalance
            (mErr, vars.sumSupply) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.cTokenBalance, vars.sumSupply);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (mErr != MathError.NO_ERROR) {
                return (uint(Error.MATH_ERROR), 0);
            }
        }

        (mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, ComptrollerImplInterface(address(comptroller)).mintedBUMs(minter));
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mErr, accountMintableBUM) = mulUInt(vars.sumSupply, ComptrollerImplInterface(address(comptroller)).bumMintRate());
        require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");

        (mErr, accountMintableBUM) = divUInt(accountMintableBUM, 10000);
        require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");


        (mErr, accountMintableBUM) = subUInt(accountMintableBUM, vars.sumBorrowPlusEffects);
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.REJECTION), 0);
        }

        return (uint(Error.NO_ERROR), accountMintableBUM);
    }

    function _setTreasuryData(address newTreasuryGuardian, address newTreasuryAddress, uint newTreasuryPercent) external returns (uint) {
        // Check caller is admin
        if (!(msg.sender == admin || msg.sender == treasuryGuardian)) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_TREASURY_OWNER_CHECK);
        }

        require(newTreasuryPercent < 1e18, "treasury percent cap overflow");

        address oldTreasuryGuardian = treasuryGuardian;
        address oldTreasuryAddress = treasuryAddress;
        uint oldTreasuryPercent = treasuryPercent;

        treasuryGuardian = newTreasuryGuardian;
        treasuryAddress = newTreasuryAddress;
        treasuryPercent = newTreasuryPercent;

        emit NewTreasuryGuardian(oldTreasuryGuardian, newTreasuryGuardian);
        emit NewTreasuryAddress(oldTreasuryAddress, newTreasuryAddress);
        emit NewTreasuryPercent(oldTreasuryPercent, newTreasuryPercent);

        return uint(Error.NO_ERROR);
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the BUM token
     * @return The address of BUM
     */
    function getBUMAddress() public view returns (address) {
        return 0xD9D574f06CE6aCc05E9816fd2d0C085157248acF;
    }
    function initialize() onlyAdmin public {
        // The counter starts true to prevent changing it from zero to non-zero (i.e. smaller cost/refund)
        _notEntered = true;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    /*** Reentrancy Guard ***/

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true; // get a gas-refund post-Istanbul
    }
}
