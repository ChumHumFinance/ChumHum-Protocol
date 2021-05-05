pragma solidity ^0.5.16;

import "./CToken.sol";
import "./PriceOracle.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./BUMControllerStorage.sol";
import "./BUMUnitroller.sol";
import "./BUM/BUM.sol";

interface ComptrollerLensInterface {
    function protocolPaused() external view returns (bool);
    function mintedBUMs(address account) external view returns (uint);
    function bumMintRate() external view returns (uint);
    function chumhumBUMRate() external view returns (uint);
    function chumhumAccrued(address account) external view returns(uint);
    function getAssetsIn(address account) external view returns (CToken[] memory);
    function oracle() external view returns (PriceOracle);

    function distributeBUMMinterChumHum(address bumMinter, bool distributeAll) external;
}

/**
 * @title ChumHum's BUM Comptroller Contract
 * @author ChumHum
 */
contract BUMControllerG1 is BUMControllerStorageG1, BUMControllerErrorReporter, Exponential {

    /// @notice Emitted when Comptroller is changed
    event NewComptroller(ComptrollerInterface oldComptroller, ComptrollerInterface newComptroller);

    /**
     * @notice Event emitted when BUM is minted
     */
    event MintBUM(address minter, uint mintBUMAmount);

    /**
     * @notice Event emitted when BUM is repaid
     */
    event RepayBUM(address repayer, uint repayBUMAmount);

    /// @notice The initial ChumHum index for a market
    uint224 public constant chumhumInitialIndex = 1e36;

    /*** Main Actions ***/

    function mintBUM(uint mintBUMAmount) external returns (uint) {
        if(address(comptroller) != address(0)) {
            require(!ComptrollerLensInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address minter = msg.sender;

            // Keep the flywheel moving
            updateChumHumBUMMintIndex();
            ComptrollerLensInterface(address(comptroller)).distributeBUMMinterChumHum(minter, false);

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

            (mErr, accountMintBUMNew) = addUInt(ComptrollerLensInterface(address(comptroller)).mintedBUMs(minter), mintBUMAmount);
            require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");
            uint error = comptroller.setMintedBUMOf(minter, accountMintBUMNew);
            if (error != 0 ) {
                return error;
            }

            BUM(getBUMAddress()).mint(minter, mintBUMAmount);
            emit MintBUM(minter, mintBUMAmount);

            return uint(Error.NO_ERROR);
        }
    }

    /**
     * @notice Repay BUM
     */
    function repayBUM(uint repayBUMAmount) external returns (uint) {
        if(address(comptroller) != address(0)) {
            require(!ComptrollerLensInterface(address(comptroller)).protocolPaused(), "protocol is paused");

            address repayer = msg.sender;

            updateChumHumBUMMintIndex();
            ComptrollerLensInterface(address(comptroller)).distributeBUMMinterChumHum(repayer, false);

            uint actualBurnAmount;

            uint bumBalance = ComptrollerLensInterface(address(comptroller)).mintedBUMs(repayer);

            if(bumBalance > repayBUMAmount) {
                actualBurnAmount = repayBUMAmount;
            } else {
                actualBurnAmount = bumBalance;
            }

            uint error = comptroller.setMintedBUMOf(repayer, bumBalance - actualBurnAmount);
            if (error != 0) {
                return error;
            }

            BUM(getBUMAddress()).burn(repayer, actualBurnAmount);
            emit RepayBUM(repayer, actualBurnAmount);

            return uint(Error.NO_ERROR);
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
    }

    /**
     * @notice Accrue CHUM to by updating the BUM minter index
     */
    function updateChumHumBUMMintIndex() public returns (uint) {
        uint bumMinterSpeed = ComptrollerLensInterface(address(comptroller)).chumhumBUMRate();
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
        uint bumMinterAmount = ComptrollerLensInterface(address(comptroller)).mintedBUMs(bumMinter);
        uint bumMinterDelta = mul_(bumMinterAmount, deltaIndex);
        uint bumMinterAccrued = add_(ComptrollerLensInterface(address(comptroller)).chumhumAccrued(bumMinter), bumMinterDelta);
        return (uint(Error.NO_ERROR), bumMinterAccrued, bumMinterDelta, bumMintIndex.mantissa);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new comptroller
      * @dev Admin function to set a new comptroller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setComptroller(ComptrollerInterface comptroller_) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COMPTROLLER_OWNER_CHECK);
        }

        ComptrollerInterface oldComptroller = comptroller;
        comptroller = comptroller_;
        emit NewComptroller(oldComptroller, comptroller_);

        return uint(Error.NO_ERROR);
    }

    function _become(BUMUnitroller unitroller) public {
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
        PriceOracle oracle = ComptrollerLensInterface(address(comptroller)).oracle();
        CToken[] memory enteredMarkets = ComptrollerLensInterface(address(comptroller)).getAssetsIn(minter);

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

        (mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, ComptrollerLensInterface(address(comptroller)).mintedBUMs(minter));
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mErr, accountMintableBUM) = mulUInt(vars.sumSupply, ComptrollerLensInterface(address(comptroller)).bumMintRate());
        require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");

        (mErr, accountMintableBUM) = divUInt(accountMintableBUM, 10000);
        require(mErr == MathError.NO_ERROR, "BUM_MINT_AMOUNT_CALCULATION_FAILED");


        (mErr, accountMintableBUM) = subUInt(accountMintableBUM, vars.sumBorrowPlusEffects);
        if (mErr != MathError.NO_ERROR) {
            return (uint(Error.REJECTION), 0);
        }

        return (uint(Error.NO_ERROR), accountMintableBUM);
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the BUM token
     * @return The address of BUM
     */
    function getBUMAddress() public view returns (address) {
        return 0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7;
    }
}
