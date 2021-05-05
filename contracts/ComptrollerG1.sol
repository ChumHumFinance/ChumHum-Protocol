pragma solidity ^0.5.16;

import "./CToken.sol";
import "./ErrorReporter.sol";
import "./Exponential.sol";
import "./PriceOracle.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerStorage.sol";
import "./Unitroller.sol";
import "./Governance/CHUM.sol";
import "./BUM/BUM.sol";

/**
 * @title ChumHum's Comptroller Contract
 * @author ChumHum
 */
contract ComptrollerG1 is ComptrollerV1Storage, ComptrollerInterfaceG1, ComptrollerErrorReporter, Exponential {
    /// @notice Emitted when an admin supports a market
    event MarketListed(CToken cToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(CToken cToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(CToken cToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(CToken cToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when maxAssets is changed by admin
    event NewMaxAssets(uint oldMaxAssets, uint newMaxAssets);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when an action is paused globally
    event ActionPaused(string action, bool pauseState);

    /// @notice Emitted when an action is paused on a market
    event ActionPaused(CToken cToken, string action, bool pauseState);

    /// @notice Emitted when market chumhum status is changed
    event MarketChumHum(CToken cToken, bool isChumHum);

    /// @notice Emitted when ChumHum rate is changed
    event NewChumHumRate(uint oldChumHumRate, uint newChumHumRate);

    /// @notice Emitted when ChumHum BUM rate is changed
    event NewChumHumBUMRate(uint oldChumHumBUMRate, uint newChumHumBUMRate);

    /// @notice Emitted when a new ChumHum speed is calculated for a market
    event ChumHumSpeedUpdated(CToken indexed cToken, uint newSpeed);

    /// @notice Emitted when CHUM is distributed to a supplier
    event DistributedSupplierChumHum(CToken indexed cToken, address indexed supplier, uint chumhumDelta, uint chumhumSupplyIndex);

    /// @notice Emitted when CHUM is distributed to a borrower
    event DistributedBorrowerChumHum(CToken indexed cToken, address indexed borrower, uint chumhumDelta, uint chumhumBorrowIndex);

    /// @notice Emitted when CHUM is distributed to a BUM minter
    event DistributedBUMMinterChumHum(address indexed bumMinter, uint chumhumDelta, uint chumhumBUMMintIndex);

    /// @notice Emitted when BUMController is changed
    event NewBUMController(BUMControllerInterface oldBUMController, BUMControllerInterface newBUMController);

    /// @notice Emitted when BUM mint rate is changed by admin
    event NewBUMMintRate(uint oldBUMMintRate, uint newBUMMintRate);

    /// @notice Emitted when protocol state is changed by admin
    event ActionProtocolPaused(bool state);

    /// @notice The threshold above which the flywheel transfers CHUM, in wei
    uint public constant chumhumClaimThreshold = 0.001e18;

    /// @notice The initial ChumHum index for a market
    uint224 public constant chumhumInitialIndex = 1e36;

    // closeFactorMantissa must be strictly greater than this value
    uint internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    // liquidationIncentiveMantissa must be no less than this value
    uint internal constant liquidationIncentiveMinMantissa = 1.0e18; // 1.0

    // liquidationIncentiveMantissa must be no greater than this value
    uint internal constant liquidationIncentiveMaxMantissa = 1.5e18; // 1.5

    constructor() public {
        admin = msg.sender;
    }

    modifier onlyProtocolAllowed {
        require(!protocolPaused, "protocol is paused");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    modifier onlyListedMarket(CToken cToken) {
        require(markets[address(cToken)].isListed, "chumhum market is not listed");
        _;
    }

    modifier validPauseState(bool state) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can");
        require(msg.sender == admin || state == true, "only admin can unpause");
        _;
    }

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (CToken[] memory) {
        return accountAssets[account];
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param cToken The cToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, CToken cToken) external view returns (bool) {
        return markets[address(cToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param cTokens The list of addresses of the cToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory) {
        uint len = cTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            results[i] = uint(addToMarketInternal(CToken(cTokens[i]), msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param cToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(CToken cToken, address borrower) internal returns (Error) {
        Market storage marketToJoin = markets[address(cToken)];

        if (!marketToJoin.isListed) {
            // market is not listed, cannot join
            return Error.MARKET_NOT_LISTED;
        }

        if (marketToJoin.accountMembership[borrower]) {
            // already joined
            return Error.NO_ERROR;
        }

        if (accountAssets[borrower].length >= maxAssets)  {
            // no space, cannot join
            return Error.TOO_MANY_ASSETS;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(cToken);

        emit MarketEntered(cToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param cTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address cTokenAddress) external returns (uint) {
        CToken cToken = CToken(cTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the cToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = cToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(cTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(cToken)];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set cToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete cToken from the account’s list of assets */
        // In order to delete cToken, copy last item in list to location of item to be removed, reduce length by 1
        CToken[] storage userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint i;
        for (; i < len; i++) {
            if (userAssetList[i] == cToken) {
                userAssetList[i] = userAssetList[len - 1];
                userAssetList.length--;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(i < len);

        emit MarketExited(cToken, msg.sender);

        return uint(Error.NO_ERROR);
    }

    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param cToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address cToken, address minter, uint mintAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintGuardianPaused[cToken], "mint is paused");

        // Hhx - currently unused
        mintAmount;

        if (!markets[cToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        updateChumHumSupplyIndex(cToken);
        distributeSupplierChumHum(cToken, minter, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates mint and reverts on rejection. May emit logs.
     * @param cToken Asset being minted
     * @param minter The address minting the tokens
     * @param actualMintAmount The amount of the underlying asset being minted
     * @param mintTokens The number of tokens being minted
     */
    function mintVerify(address cToken, address minter, uint actualMintAmount, uint mintTokens) external {
        // Hhx - currently unused
        cToken;
        minter;
        actualMintAmount;
        mintTokens;
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param cToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of cTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address cToken, address redeemer, uint redeemTokens) external onlyProtocolAllowed returns (uint) {
        uint allowed = redeemAllowedInternal(cToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateChumHumSupplyIndex(cToken);
        distributeSupplierChumHum(cToken, redeemer, false);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address cToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        if (!markets[cToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[cToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, CToken(cToken), redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param cToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address cToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        // Hhx - currently unused
        cToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        require(redeemTokens != 0 || redeemAmount == 0, "redeemTokens zero");
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param cToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address cToken, address borrower, uint borrowAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!borrowGuardianPaused[cToken], "borrow is paused");

        if (!markets[cToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (!markets[cToken].accountMembership[borrower]) {
            // only cTokens may call borrowAllowed if borrower not in market
            require(msg.sender == cToken, "sender must be cToken");

            // attempt to add borrower to the market
            Error err = addToMarketInternal(CToken(cToken), borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }
        }

        if (oracle.getUnderlyingPrice(CToken(cToken)) == 0) {
            return uint(Error.PRICE_ERROR);
        }

        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, CToken(cToken), 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall != 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: CToken(cToken).borrowIndex()});
        updateChumHumBorrowIndex(cToken, borrowIndex);
        distributeBorrowerChumHum(cToken, borrower, borrowIndex, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates borrow and reverts on rejection. May emit logs.
     * @param cToken Asset whose underlying is being borrowed
     * @param borrower The address borrowing the underlying
     * @param borrowAmount The amount of the underlying asset requested to borrow
     */
    function borrowVerify(address cToken, address borrower, uint borrowAmount) external {
        // Hhx - currently unused
        cToken;
        borrower;
        borrowAmount;

        // Hhx - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param cToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which would repay the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address cToken,
        address payer,
        address borrower,
        uint repayAmount) external onlyProtocolAllowed returns (uint) {
        // Hhx - currently unused
        payer;
        borrower;
        repayAmount;

        if (!markets[cToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: CToken(cToken).borrowIndex()});
        updateChumHumBorrowIndex(cToken, borrowIndex);
        distributeBorrowerChumHum(cToken, borrower, borrowIndex, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates repayBorrow and reverts on rejection. May emit logs.
     * @param cToken Asset being repaid
     * @param payer The address repaying the borrow
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function repayBorrowVerify(
        address cToken,
        address payer,
        address borrower,
        uint actualRepayAmount,
        uint borrowerIndex) external {
        // Hhx - currently unused
        cToken;
        payer;
        borrower;
        actualRepayAmount;
        borrowerIndex;

        // Hhx - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param cTokenBorrowed Asset which was borrowed by the borrower
     * @param cTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address cTokenBorrowed,
        address cTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external onlyProtocolAllowed returns (uint) {
        // Hhx - currently unused
        liquidator;

        if (!markets[cTokenBorrowed].isListed || !markets[cTokenCollateral].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* The borrower must have shortfall in order to be liquidatable */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, CToken(0), 0, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall == 0) {
            return uint(Error.INSUFFICIENT_SHORTFALL);
        }

        /* The liquidator may not repay more than what is allowed by the closeFactor */
        uint borrowBalance = CToken(cTokenBorrowed).borrowBalanceStored(borrower);
        (MathError mathErr, uint maxClose) = mulScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
        if (mathErr != MathError.NO_ERROR) {
            return uint(Error.MATH_ERROR);
        }
        if (repayAmount > maxClose) {
            return uint(Error.TOO_MUCH_REPAY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates liquidateBorrow and reverts on rejection. May emit logs.
     * @param cTokenBorrowed Asset which was borrowed by the borrower
     * @param cTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function liquidateBorrowVerify(
        address cTokenBorrowed,
        address cTokenCollateral,
        address liquidator,
        address borrower,
        uint actualRepayAmount,
        uint seizeTokens) external {
        // Hhx - currently unused
        cTokenBorrowed;
        cTokenCollateral;
        liquidator;
        borrower;
        actualRepayAmount;
        seizeTokens;

        // Hhx - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param cTokenCollateral Asset which was used as collateral and will be seized
     * @param cTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address cTokenCollateral,
        address cTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!seizeGuardianPaused, "seize is paused");

        // Hhx - currently unused
        seizeTokens;

        if (!markets[cTokenCollateral].isListed || !markets[cTokenBorrowed].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (CToken(cTokenCollateral).comptroller() != CToken(cTokenBorrowed).comptroller()) {
            return uint(Error.COMPTROLLER_MISMATCH);
        }

        // Keep the flywheel moving
        updateChumHumSupplyIndex(cTokenCollateral);
        distributeSupplierChumHum(cTokenCollateral, borrower, false);
        distributeSupplierChumHum(cTokenCollateral, liquidator, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates seize and reverts on rejection. May emit logs.
     * @param cTokenCollateral Asset which was used as collateral and will be seized
     * @param cTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeVerify(
        address cTokenCollateral,
        address cTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external {
        // Hhx - currently unused
        cTokenCollateral;
        cTokenBorrowed;
        liquidator;
        borrower;
        seizeTokens;

        // Hhx - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param cToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of cTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(address cToken, address src, address dst, uint transferTokens) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!transferGuardianPaused, "transfer is paused");

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(cToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateChumHumSupplyIndex(cToken);
        distributeSupplierChumHum(cToken, src, false);
        distributeSupplierChumHum(cToken, dst, false);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates transfer and reverts on rejection. May emit logs.
     * @param cToken Asset being transferred
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of cTokens to transfer
     */
    function transferVerify(address cToken, address src, address dst, uint transferTokens) external {
        // Hhx - currently unused
        cToken;
        src;
        dst;
        transferTokens;

        // Hhx - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /*** Liquidity/Liquidation Calculations ***/

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `cTokenBalance` is the number of cTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
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

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, CToken(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param cTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address cTokenModify,
        uint redeemTokens,
        uint borrowAmount) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, CToken(cTokenModify), redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param cTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral cToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        CToken cTokenModify,
        uint redeemTokens,
        uint borrowAmount) internal view returns (Error, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;
        MathError mErr;

        // For each asset the account is in
        CToken[] memory assets = accountAssets[account];
        for (uint i = 0; i < assets.length; i++) {
            CToken asset = assets[i];

            // Read the balances and exchange rate from the cToken
            (oErr, vars.cTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset.getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (Error.SNAPSHOT_ERROR, 0, 0);
            }
            vars.collateralFactor = Exp({mantissa: markets[address(asset)].collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (Error.PRICE_ERROR, 0, 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> bnb (normalized price value)
            (mErr, vars.tokensToDenom) = mulExp3(vars.collateralFactor, vars.exchangeRate, vars.oraclePrice);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // sumCollateral += tokensToDenom * cTokenBalance
            (mErr, vars.sumCollateral) = mulScalarTruncateAddUInt(vars.tokensToDenom, vars.cTokenBalance, vars.sumCollateral);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);
            if (mErr != MathError.NO_ERROR) {
                return (Error.MATH_ERROR, 0, 0);
            }

            // Calculate effects of interacting with cTokenModify
            if (asset == cTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0);
                }

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                (mErr, vars.sumBorrowPlusEffects) = mulScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
                if (mErr != MathError.NO_ERROR) {
                    return (Error.MATH_ERROR, 0, 0);
                }
            }
        }

        /// @dev BUM Integration^
        (mErr, vars.sumBorrowPlusEffects) = addUInt(vars.sumBorrowPlusEffects, mintedBUMs[account]);
        if (mErr != MathError.NO_ERROR) {
            return (Error.MATH_ERROR, 0, 0);
        }
        /// @dev BUM Integration$

        // These are safe, as the underflow condition is checked first
        if (vars.sumCollateral > vars.sumBorrowPlusEffects) {
            return (Error.NO_ERROR, vars.sumCollateral - vars.sumBorrowPlusEffects, 0);
        } else {
            return (Error.NO_ERROR, 0, vars.sumBorrowPlusEffects - vars.sumCollateral);
        }
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in cToken.liquidateBorrowFresh)
     * @param cTokenBorrowed The address of the borrowed cToken
     * @param cTokenCollateral The address of the collateral cToken
     * @param actualRepayAmount The amount of cTokenBorrowed underlying to convert into cTokenCollateral tokens
     * @return (errorCode, number of cTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(address cTokenBorrowed, address cTokenCollateral, uint actualRepayAmount) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = oracle.getUnderlyingPrice(CToken(cTokenBorrowed));
        uint priceCollateralMantissa = oracle.getUnderlyingPrice(CToken(cTokenCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = CToken(cTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;
        MathError mathErr;

        (mathErr, numerator) = mulExp(liquidationIncentiveMantissa, priceBorrowedMantissa);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, denominator) = mulExp(priceCollateralMantissa, exchangeRateMantissa);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, ratio) = divExp(numerator, denominator);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        (mathErr, seizeTokens) = mulScalarTruncate(ratio, actualRepayAmount);
        if (mathErr != MathError.NO_ERROR) {
            return (uint(Error.MATH_ERROR), 0);
        }

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new price oracle for the comptroller
      * @dev Admin function to set a new price oracle
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setPriceOracle(PriceOracle newOracle) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PRICE_ORACLE_OWNER_CHECK);
        }

        // Track the old oracle for the comptroller
        PriceOracle oldOracle = oracle;

        // Set comptroller's oracle to newOracle
        oracle = newOracle;

        // Emit NewPriceOracle(oldOracle, newOracle)
        emit NewPriceOracle(oldOracle, newOracle);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_CLOSE_FACTOR_OWNER_CHECK);
        }

        Exp memory newCloseFactorExp = Exp({mantissa: newCloseFactorMantissa});
        Exp memory lowLimit = Exp({mantissa: closeFactorMinMantissa});
        if (lessThanOrEqualExp(newCloseFactorExp, lowLimit)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        Exp memory highLimit = Exp({mantissa: closeFactorMaxMantissa});
        if (lessThanExp(highLimit, newCloseFactorExp)) {
            return fail(Error.INVALID_CLOSE_FACTOR, FailureInfo.SET_CLOSE_FACTOR_VALIDATION);
        }

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, newCloseFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Admin function to set per-market collateralFactor
      * @param cToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(CToken cToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COLLATERAL_FACTOR_OWNER_CHECK);
        }

        // Verify market is listed
        Market storage market = markets[address(cToken)];
        if (!market.isListed) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SET_COLLATERAL_FACTOR_NO_EXISTS);
        }

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && oracle.getUnderlyingPrice(cToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(cToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets maxAssets which controls how many markets can be entered
      * @dev Admin function to set maxAssets
      * @param newMaxAssets New max assets
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setMaxAssets(uint newMaxAssets) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_MAX_ASSETS_OWNER_CHECK);
        }

        uint oldMaxAssets = maxAssets;
        maxAssets = newMaxAssets;
        emit NewMaxAssets(oldMaxAssets, newMaxAssets);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_LIQUIDATION_INCENTIVE_OWNER_CHECK);
        }

        // Check de-scaled min <= newLiquidationIncentive <= max
        Exp memory newLiquidationIncentive = Exp({mantissa: newLiquidationIncentiveMantissa});
        Exp memory minLiquidationIncentive = Exp({mantissa: liquidationIncentiveMinMantissa});
        if (lessThanExp(newLiquidationIncentive, minLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        Exp memory maxLiquidationIncentive = Exp({mantissa: liquidationIncentiveMaxMantissa});
        if (lessThanExp(maxLiquidationIncentive, newLiquidationIncentive)) {
            return fail(Error.INVALID_LIQUIDATION_INCENTIVE, FailureInfo.SET_LIQUIDATION_INCENTIVE_VALIDATION);
        }

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param cToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(CToken cToken) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SUPPORT_MARKET_OWNER_CHECK);
        }

        if (markets[address(cToken)].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        cToken.isCToken(); // Sanity check to make sure its really a CToken

        markets[address(cToken)] = Market({isListed: true, isChumHum: false, collateralFactorMantissa: 0});

        _addMarketInternal(cToken);

        emit MarketListed(cToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(CToken cToken) internal {
        for (uint i = 0; i < allMarkets.length; i ++) {
            require(allMarkets[i] != cToken, "market already added");
        }
        allMarkets.push(cToken);
    }

    /**
     * @notice Admin function to change the Pause Guardian
     * @param newPauseGuardian The address of the new Pause Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setPauseGuardian(address newPauseGuardian) public returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PAUSE_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldPauseGuardian = pauseGuardian;

        // Store pauseGuardian with value newPauseGuardian
        pauseGuardian = newPauseGuardian;

        // Emit NewPauseGuardian(OldPauseGuardian, NewPauseGuardian)
        emit NewPauseGuardian(oldPauseGuardian, newPauseGuardian);

        return uint(Error.NO_ERROR);
    }

    function _setMintPaused(CToken cToken, bool state) public onlyListedMarket(cToken) validPauseState(state) returns (bool) {
        mintGuardianPaused[address(cToken)] = state;
        emit ActionPaused(cToken, "Mint", state);
        return state;
    }

    function _setBorrowPaused(CToken cToken, bool state) public onlyListedMarket(cToken) validPauseState(state) returns (bool) {
        borrowGuardianPaused[address(cToken)] = state;
        emit ActionPaused(cToken, "Borrow", state);
        return state;
    }

    function _setTransferPaused(bool state) public validPauseState(state) returns (bool) {
        transferGuardianPaused = state;
        emit ActionPaused("Transfer", state);
        return state;
    }

    function _setSeizePaused(bool state) public validPauseState(state) returns (bool) {
        seizeGuardianPaused = state;
        emit ActionPaused("Seize", state);
        return state;
    }

    function _setMintBUMPaused(bool state) public validPauseState(state) returns (bool) {
        mintBUMGuardianPaused = state;
        emit ActionPaused("MintBUM", state);
        return state;
    }

    function _setRepayBUMPaused(bool state) public validPauseState(state) returns (bool) {
        repayBUMGuardianPaused = state;
        emit ActionPaused("RepayBUM", state);
        return state;
    }
    /**
     * @notice Set whole protocol pause/unpause state
     */
    function _setProtocolPaused(bool state) public onlyAdmin returns(bool) {
        protocolPaused = state;
        emit ActionProtocolPaused(state);
        return state;
    }

    /**
      * @notice Sets a new BUM controller
      * @dev Admin function to set a new BUM controller
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setBUMController(BUMControllerInterface bumController_) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_BUMCONTROLLER_OWNER_CHECK);
        }

        BUMControllerInterface oldRate = bumController;
        bumController = bumController_;
        emit NewBUMController(oldRate, bumController_);
    }

    function _setBUMMintRate(uint newBUMMintRate) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_BUM_MINT_RATE_CHECK);
        }

        uint oldBUMMintRate = bumMintRate;
        bumMintRate = newBUMMintRate;
        emit NewBUMMintRate(oldBUMMintRate, newBUMMintRate);

        return uint(Error.NO_ERROR);
    }

    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can");
        require(unitroller._acceptImplementation() == 0, "not authorized");
    }

    /*** ChumHum Distribution ***/

    /**
     * @notice Recalculate and update ChumHum speeds for all ChumHum markets
     */
    function refreshChumHumSpeeds() public {
        require(msg.sender == tx.origin, "only externally owned accounts can");
        refreshChumHumSpeedsInternal();
    }

    function refreshChumHumSpeedsInternal() internal {
        uint i;
        CToken cToken;

        for (i = 0; i < allMarkets.length; i++) {
            cToken = allMarkets[i];
            Exp memory borrowIndex = Exp({mantissa: cToken.borrowIndex()});
            updateChumHumSupplyIndex(address(cToken));
            updateChumHumBorrowIndex(address(cToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets.length);
        for (i = 0; i < allMarkets.length; i++) {
            cToken = allMarkets[i];
            if (markets[address(cToken)].isChumHum) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(cToken)});
                Exp memory utility = mul_(assetPrice, cToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (i = 0; i < allMarkets.length; i++) {
            cToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(chumhumRate, div_(utilities[i], totalUtility)) : 0;
            chumhumSpeeds[address(cToken)] = newSpeed;
            emit ChumHumSpeedUpdated(cToken, newSpeed);
        }
    }

    /**
     * @notice Accrue CHUM to the market by updating the supply index
     * @param cToken The market whose supply index to update
     */
    function updateChumHumSupplyIndex(address cToken) internal {
        ChumHumMarketState storage supplyState = chumhumSupplyState[cToken];
        uint supplySpeed = chumhumSpeeds[cToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = CToken(cToken).totalSupply();
            uint chumhumAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(chumhumAccrued, supplyTokens) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: supplyState.index}), ratio);
            chumhumSupplyState[cToken] = ChumHumMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            supplyState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Accrue CHUM to the market by updating the borrow index
     * @param cToken The market whose borrow index to update
     */
    function updateChumHumBorrowIndex(address cToken, Exp memory marketBorrowIndex) internal {
        ChumHumMarketState storage borrowState = chumhumBorrowState[cToken];
        uint borrowSpeed = chumhumSpeeds[cToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(CToken(cToken).totalBorrows(), marketBorrowIndex);
            uint chumhumAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(chumhumAccrued, borrowAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: borrowState.index}), ratio);
            chumhumBorrowState[cToken] = ChumHumMarketState({
                index: safe224(index.mantissa, "new index overflows"),
                block: safe32(blockNumber, "block number overflows")
            });
        } else if (deltaBlocks > 0) {
            borrowState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @notice Accrue CHUM to by updating the BUM minter index
     */
    function updateChumHumBUMMintIndex() internal {
        if (address(bumController) != address(0)) {
            bumController.updateChumHumBUMMintIndex();
        }
    }

    /**
     * @notice Calculate CHUM accrued by a supplier and possibly transfer it to them
     * @param cToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute CHUM to
     */
    function distributeSupplierChumHum(address cToken, address supplier, bool distributeAll) internal {
        ChumHumMarketState storage supplyState = chumhumSupplyState[cToken];
        Double memory supplyIndex = Double({mantissa: supplyState.index});
        Double memory supplierIndex = Double({mantissa: chumhumSupplierIndex[cToken][supplier]});
        chumhumSupplierIndex[cToken][supplier] = supplyIndex.mantissa;

        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = chumhumInitialIndex;
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = CToken(cToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        uint supplierAccrued = add_(chumhumAccrued[supplier], supplierDelta);
        chumhumAccrued[supplier] = transferCHUM(supplier, supplierAccrued, distributeAll ? 0 : chumhumClaimThreshold);
        emit DistributedSupplierChumHum(CToken(cToken), supplier, supplierDelta, supplyIndex.mantissa);
    }

    /**
     * @notice Calculate CHUM accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param cToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute CHUM to
     */
    function distributeBorrowerChumHum(address cToken, address borrower, Exp memory marketBorrowIndex, bool distributeAll) internal {
        ChumHumMarketState storage borrowState = chumhumBorrowState[cToken];
        Double memory borrowIndex = Double({mantissa: borrowState.index});
        Double memory borrowerIndex = Double({mantissa: chumhumBorrowerIndex[cToken][borrower]});
        chumhumBorrowerIndex[cToken][borrower] = borrowIndex.mantissa;

        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(CToken(cToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            uint borrowerAccrued = add_(chumhumAccrued[borrower], borrowerDelta);
            chumhumAccrued[borrower] = transferCHUM(borrower, borrowerAccrued, distributeAll ? 0 : chumhumClaimThreshold);
            emit DistributedBorrowerChumHum(CToken(cToken), borrower, borrowerDelta, borrowIndex.mantissa);
        }
    }

    /**
     * @notice Calculate CHUM accrued by a BUM minter and possibly transfer it to them
     * @dev BUM minters will not begin to accrue until after the first interaction with the protocol.
     * @param bumMinter The address of the BUM minter to distribute CHUM to
     */
    function distributeBUMMinterChumHum(address bumMinter, bool distributeAll) internal {
        if (address(bumController) != address(0)) {
            uint bumMinterAccrued;
            uint bumMinterDelta;
            uint bumMintIndexMantissa;
            uint err;
            (err, bumMinterAccrued, bumMinterDelta, bumMintIndexMantissa) = bumController.calcDistributeBUMMinterChumHum(bumMinter);
            if (err == uint(Error.NO_ERROR)) {
                chumhumAccrued[bumMinter] = transferCHUM(bumMinter, bumMinterAccrued, distributeAll ? 0 : chumhumClaimThreshold);
                emit DistributedBUMMinterChumHum(bumMinter, bumMinterDelta, bumMintIndexMantissa);
            }
        }
    }

    /**
     * @notice Transfer CHUM to the user, if they are above the threshold
     * @dev Note: If there is not enough CHUM, we do not perform the transfer all.
     * @param user The address of the user to transfer CHUM to
     * @param userAccrued The amount of CHUM to (possibly) transfer
     * @return The amount of CHUM which was NOT transferred to the user
     */
    function transferCHUM(address user, uint userAccrued, uint threshold) internal returns (uint) {
        if (userAccrued >= threshold && userAccrued > 0) {
            CHUM chum = CHUM(getCHUMAddress());
            uint chumRemaining = chum.balanceOf(address(this));
            if (userAccrued <= chumRemaining) {
                chum.transfer(user, userAccrued);
                return 0;
            }
        }
        return userAccrued;
    }

    /**
     * @notice Claim all the chum accrued by holder in all markets and BUM
     * @param holder The address to claim CHUM for
     */
    function claimChumHum(address holder) public {
        return claimChumHum(holder, allMarkets);
    }

    /**
     * @notice Claim all the chum accrued by holder in the specified markets
     * @param holder The address to claim CHUM for
     * @param cTokens The list of markets to claim CHUM in
     */
    function claimChumHum(address holder, CToken[] memory cTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimChumHum(holders, cTokens, true, true);
    }

    /**
     * @notice Claim all chum accrued by the holders
     * @param holders The addresses to claim CHUM for
     * @param cTokens The list of markets to claim CHUM in
     * @param borrowers Whether or not to claim CHUM earned by borrowing
     * @param suppliers Whether or not to claim CHUM earned by supplying
     */
    function claimChumHum(address[] memory holders, CToken[] memory cTokens, bool borrowers, bool suppliers) public {
        uint j;
        updateChumHumBUMMintIndex();
        for (j = 0; j < holders.length; j++) {
            distributeBUMMinterChumHum(holders[j], true);
        }
        for (uint i = 0; i < cTokens.length; i++) {
            CToken cToken = cTokens[i];
            require(markets[address(cToken)].isListed, "not listed market");
            if (borrowers) {
                Exp memory borrowIndex = Exp({mantissa: cToken.borrowIndex()});
                updateChumHumBorrowIndex(address(cToken), borrowIndex);
                for (j = 0; j < holders.length; j++) {
                    distributeBorrowerChumHum(address(cToken), holders[j], borrowIndex, true);
                }
            }
            if (suppliers) {
                updateChumHumSupplyIndex(address(cToken));
                for (j = 0; j < holders.length; j++) {
                    distributeSupplierChumHum(address(cToken), holders[j], true);
                }
            }
        }
    }

    /*** ChumHum Distribution Admin ***/

    /**
     * @notice Set the amount of CHUM distributed per block
     * @param chumhumRate_ The amount of CHUM wei per block to distribute
     */
    function _setChumHumRate(uint chumhumRate_) public onlyAdmin {
        uint oldRate = chumhumRate;
        chumhumRate = chumhumRate_;
        emit NewChumHumRate(oldRate, chumhumRate_);

        refreshChumHumSpeedsInternal();
    }

    /**
     * @notice Set the amount of CHUM distributed per block to BUM Mint
     * @param chumhumBUMRate_ The amount of CHUM wei per block to distribute to BUM Mint
     */
    function _setChumHumBUMRate(uint chumhumBUMRate_) public {
        require(msg.sender == admin, "only admin can");

        uint oldBUMRate = chumhumBUMRate;
        chumhumBUMRate = chumhumBUMRate_;
        emit NewChumHumBUMRate(oldBUMRate, chumhumBUMRate_);
    }

    /**
     * @notice Add markets to chumhumMarkets, allowing them to earn CHUM in the flywheel
     * @param cTokens The addresses of the markets to add
     */
    function _addChumHumMarkets(address[] calldata cTokens) external onlyAdmin {
        for (uint i = 0; i < cTokens.length; i++) {
            _addChumHumMarketInternal(cTokens[i]);
        }

        refreshChumHumSpeedsInternal();
    }

    function _addChumHumMarketInternal(address cToken) internal {
        Market storage market = markets[cToken];
        require(market.isListed, "chumhum market is not listed");
        require(!market.isChumHum, "chumhum market already added");

        market.isChumHum = true;
        emit MarketChumHum(CToken(cToken), true);

        if (chumhumSupplyState[cToken].index == 0 && chumhumSupplyState[cToken].block == 0) {
            chumhumSupplyState[cToken] = ChumHumMarketState({
                index: chumhumInitialIndex,
                block: safe32(getBlockNumber(), "block number overflows")
            });
        }

        if (chumhumBorrowState[cToken].index == 0 && chumhumBorrowState[cToken].block == 0) {
            chumhumBorrowState[cToken] = ChumHumMarketState({
                index: chumhumInitialIndex,
                block: safe32(getBlockNumber(), "block number overflows")
            });
        }
    }

    function _initializeChumHumBUMState(uint blockNumber) public {
        require(msg.sender == admin, "only admin can");
        if (address(bumController) != address(0)) {
            bumController._initializeChumHumBUMState(blockNumber);
        }
    }

    /**
     * @notice Remove a market from chumhumMarkets, preventing it from earning CHUM in the flywheel
     * @param cToken The address of the market to drop
     */
    function _dropChumHumMarket(address cToken) public onlyAdmin {
        Market storage market = markets[cToken];
        require(market.isChumHum == true, "not chumhum market");

        market.isChumHum = false;
        emit MarketChumHum(CToken(cToken), false);

        refreshChumHumSpeedsInternal();
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (CToken[] memory) {
        return allMarkets;
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the CHUM token
     * @return The address of CHUM
     */
    function getCHUMAddress() public view returns (address) {
        return 0xb7F8d13CFaDf5acD3Ef9C93d5472344C5151f979;
    }

    /*** BUM functions ***/

    /**
     * @notice Set the minted BUM amount of the `owner`
     * @param owner The address of the account to set
     * @param amount The amount of BUM to set to the account
     * @return The number of minted BUM by `owner`
     */
    function setMintedBUMOf(address owner, uint amount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintBUMGuardianPaused && !repayBUMGuardianPaused, "BUM is paused");
        // Check caller is bumController
        if (msg.sender != address(bumController)) {
            return fail(Error.REJECTION, FailureInfo.SET_MINTED_BUM_REJECTION);
        }
        mintedBUMs[owner] = amount;

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Mint BUM
     */
    function mintBUM(uint mintBUMAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintBUMGuardianPaused, "mintBUM is paused");

        // Keep the flywheel moving
        updateChumHumBUMMintIndex();
        distributeBUMMinterChumHum(msg.sender, false);
        return bumController.mintBUM(msg.sender, mintBUMAmount);
    }

    /**
     * @notice Repay BUM
     */
    function repayBUM(uint repayBUMAmount) external onlyProtocolAllowed returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!repayBUMGuardianPaused, "repayBUM is paused");

        // Keep the flywheel moving
        updateChumHumBUMMintIndex();
        distributeBUMMinterChumHum(msg.sender, false);
        return bumController.repayBUM(msg.sender, repayBUMAmount);
    }

    /**
     * @notice Get the minted BUM amount of the `owner`
     * @param owner The address of the account to query
     * @return The number of minted BUM by `owner`
     */
    function mintedBUMOf(address owner) external view returns (uint) {
        return mintedBUMs[owner];
    }

    /**
     * @notice Get Mintable BUM amount
     */
    function getMintableBUM(address minter) external view returns (uint, uint) {
        return bumController.getMintableBUM(minter);
    }
}
