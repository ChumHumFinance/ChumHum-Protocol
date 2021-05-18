pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";
import "../../contracts/PriceOracle.sol";

contract ComptrollerKovan is Comptroller {
  function getCHUMAddress() public view returns (address) {
    return 0x61460874a7196d6a22D1eE4922473664b3E95270;
  }
}

contract ComptrollerRopsten is Comptroller {
  function getCHUMAddress() public view returns (address) {
    return 0x1Fe16De955718CFAb7A44605458AB023838C2793;
  }
}

contract ComptrollerHarness is Comptroller {
    address chumAddress;
    uint public blockNumber;

    constructor() Comptroller() public {}

    function setChumHumSupplyState(address cToken, uint224 index, uint32 blockNumber_) public {
        chumhumSupplyState[cToken].index = index;
        chumhumSupplyState[cToken].block = blockNumber_;
    }

    function setChumHumBorrowState(address cToken, uint224 index, uint32 blockNumber_) public {
        chumhumBorrowState[cToken].index = index;
        chumhumBorrowState[cToken].block = blockNumber_;
    }

    function setChumHumAccrued(address user, uint userAccrued) public {
        chumhumAccrued[user] = userAccrued;
    }

    function setCHUMAddress(address chumAddress_) public {
        chumAddress = chumAddress_;
    }

    function getCHUMAddress() public view returns (address) {
        return chumAddress;
    }

    /**
     * @notice Set the amount of CHUM distributed per block
     * @param chumhumRate_ The amount of CHUM wei per block to distribute
     */
    function harnessSetChumHumRate(uint chumhumRate_) public {
        chumhumRate = chumhumRate_;
    }

    /**
     * @notice Recalculate and update CHUM speeds for all CHUM markets
     */
    function harnessRefreshChumHumSpeeds() public {
        CToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: cToken.borrowIndex()});
            updateChumHumSupplyIndex(address(cToken));
            updateChumHumBorrowIndex(address(cToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets_[i];
            if (chumhumSpeeds[address(cToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(cToken)});
                Exp memory utility = mul_(assetPrice, cToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(chumhumRate, div_(utilities[i], totalUtility)) : 0;
            setChumHumSpeedInternal(cToken, newSpeed);
        }
    }

    function setChumHumBorrowerIndex(address cToken, address borrower, uint index) public {
        chumhumBorrowerIndex[cToken][borrower] = index;
    }

    function setChumHumSupplierIndex(address cToken, address supplier, uint index) public {
        chumhumSupplierIndex[cToken][supplier] = index;
    }

    function harnessDistributeAllBorrowerChumHum(address cToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerChumHum(cToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
        chumhumAccrued[borrower] = grantCHUMInternal(borrower, chumhumAccrued[borrower]);
    }

    function harnessDistributeAllSupplierChumHum(address cToken, address supplier) public {
        distributeSupplierChumHum(cToken, supplier);
        chumhumAccrued[supplier] = grantCHUMInternal(supplier, chumhumAccrued[supplier]);
    }

    function harnessUpdateChumHumBorrowIndex(address cToken, uint marketBorrowIndexMantissa) public {
        updateChumHumBorrowIndex(cToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdateChumHumSupplyIndex(address cToken) public {
        updateChumHumSupplyIndex(cToken);
    }

    function harnessDistributeBorrowerChumHum(address cToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerChumHum(cToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessDistributeSupplierChumHum(address cToken, address supplier) public {
        distributeSupplierChumHum(cToken, supplier);
    }

    function harnessDistributeBUMMinterChumHum(address bumMinter) public {
        distributeBUMMinterChumHum(bumMinter);
    }

    function harnessTransferChumHum(address user, uint userAccrued, uint threshold) public returns (uint) {
        if (userAccrued > 0 && userAccrued >= threshold) {
            return grantCHUMInternal(user, userAccrued);
        }
        return userAccrued;
    }

    function harnessAddChumHumMarkets(address[] memory cTokens) public {
        for (uint i = 0; i < cTokens.length; i++) {
            // temporarily set chumhumSpeed to 1 (will be fixed by `harnessRefreshChumHumSpeeds`)
            setChumHumSpeedInternal(CToken(cTokens[i]), 1);
        }
    }

    function harnessSetMintedBUMs(address user, uint amount) public {
        mintedBUMs[user] = amount;
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getChumHumMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (chumhumSpeeds[address(allMarkets[i])] > 0) {
                n++;
            }
        }

        address[] memory chumhumMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (chumhumSpeeds[address(allMarkets[i])] > 0) {
                chumhumMarkets[k++] = address(allMarkets[i]);
            }
        }
        return chumhumMarkets;
    }
}

contract ComptrollerBorked {
    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        unitroller._acceptImplementation();
    }
}

contract BoolComptroller is ComptrollerInterface {
    bool allowMint = true;
    bool allowRedeem = true;
    bool allowBorrow = true;
    bool allowRepayBorrow = true;
    bool allowLiquidateBorrow = true;
    bool allowSeize = true;
    bool allowTransfer = true;

    bool verifyMint = true;
    bool verifyRedeem = true;
    bool verifyBorrow = true;
    bool verifyRepayBorrow = true;
    bool verifyLiquidateBorrow = true;
    bool verifySeize = true;
    bool verifyTransfer = true;

    bool failCalculateSeizeTokens;
    uint calculatedSeizeTokens;

    bool public protocolPaused = false;

    mapping(address => uint) public mintedBUMs;
    bool bumFailCalculateSeizeTokens;
    uint bumCalculatedSeizeTokens;

    uint noError = 0;
    uint opaqueError = noError + 11; // an arbitrary, opaque error code

    address public treasuryGuardian;
    address public treasuryAddress;
    uint public treasuryPercent;

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata _cTokens) external returns (uint[] memory) {
        _cTokens;
        uint[] memory ret;
        return ret;
    }

    function exitMarket(address _cToken) external returns (uint) {
        _cToken;
        return noError;
    }

    /*** Policy Hooks ***/

    function mintAllowed(address _cToken, address _minter, uint _mintAmount) external returns (uint) {
        _cToken;
        _minter;
        _mintAmount;
        return allowMint ? noError : opaqueError;
    }

    function mintVerify(address _cToken, address _minter, uint _mintAmount, uint _mintTokens) external {
        _cToken;
        _minter;
        _mintAmount;
        _mintTokens;
        require(verifyMint, "mintVerify rejected mint");
    }

    function redeemAllowed(address _cToken, address _redeemer, uint _redeemTokens) external returns (uint) {
        _cToken;
        _redeemer;
        _redeemTokens;
        return allowRedeem ? noError : opaqueError;
    }

    function redeemVerify(address _cToken, address _redeemer, uint _redeemAmount, uint _redeemTokens) external {
        _cToken;
        _redeemer;
        _redeemAmount;
        _redeemTokens;
        require(verifyRedeem, "redeemVerify rejected redeem");
    }

    function borrowAllowed(address _cToken, address _borrower, uint _borrowAmount) external returns (uint) {
        _cToken;
        _borrower;
        _borrowAmount;
        return allowBorrow ? noError : opaqueError;
    }

    function borrowVerify(address _cToken, address _borrower, uint _borrowAmount) external {
        _cToken;
        _borrower;
        _borrowAmount;
        require(verifyBorrow, "borrowVerify rejected borrow");
    }

    function repayBorrowAllowed(
        address _cToken,
        address _payer,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _cToken;
        _payer;
        _borrower;
        _repayAmount;
        return allowRepayBorrow ? noError : opaqueError;
    }

    function repayBorrowVerify(
        address _cToken,
        address _payer,
        address _borrower,
        uint _repayAmount,
        uint _borrowerIndex) external {
        _cToken;
        _payer;
        _borrower;
        _repayAmount;
        _borrowerIndex;
        require(verifyRepayBorrow, "repayBorrowVerify rejected repayBorrow");
    }

    function liquidateBorrowAllowed(
        address _cTokenBorrowed,
        address _cTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _cTokenBorrowed;
        _cTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        return allowLiquidateBorrow ? noError : opaqueError;
    }

    function liquidateBorrowVerify(
        address _cTokenBorrowed,
        address _cTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount,
        uint _seizeTokens) external {
        _cTokenBorrowed;
        _cTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        _seizeTokens;
        require(verifyLiquidateBorrow, "liquidateBorrowVerify rejected liquidateBorrow");
    }

    function seizeAllowed(
        address _cTokenCollateral,
        address _cTokenBorrowed,
        address _borrower,
        address _liquidator,
        uint _seizeTokens) external returns (uint) {
        _cTokenCollateral;
        _cTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        return allowSeize ? noError : opaqueError;
    }

    function seizeVerify(
        address _cTokenCollateral,
        address _cTokenBorrowed,
        address _liquidator,
        address _borrower,
        uint _seizeTokens) external {
        _cTokenCollateral;
        _cTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        require(verifySeize, "seizeVerify rejected seize");
    }

    function transferAllowed(
        address _cToken,
        address _src,
        address _dst,
        uint _transferTokens) external returns (uint) {
        _cToken;
        _src;
        _dst;
        _transferTokens;
        return allowTransfer ? noError : opaqueError;
    }

    function transferVerify(
        address _cToken,
        address _src,
        address _dst,
        uint _transferTokens) external {
        _cToken;
        _src;
        _dst;
        _transferTokens;
        require(verifyTransfer, "transferVerify rejected transfer");
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _cTokenBorrowed,
        address _cTokenCollateral,
        uint _repayAmount) external view returns (uint, uint) {
        _cTokenBorrowed;
        _cTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    /*** Special Liquidation Calculation ***/

    function liquidateBUMCalculateSeizeTokens(
        address _cTokenCollateral,
        uint _repayAmount) external view returns (uint, uint) {
        _cTokenCollateral;
        _repayAmount;
        return bumFailCalculateSeizeTokens ? (opaqueError, 0) : (noError, bumCalculatedSeizeTokens);
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setMintVerify(bool verifyMint_) public {
        verifyMint = verifyMint_;
    }

    function setRedeemAllowed(bool allowRedeem_) public {
        allowRedeem = allowRedeem_;
    }

    function setRedeemVerify(bool verifyRedeem_) public {
        verifyRedeem = verifyRedeem_;
    }

    function setBorrowAllowed(bool allowBorrow_) public {
        allowBorrow = allowBorrow_;
    }

    function setBorrowVerify(bool verifyBorrow_) public {
        verifyBorrow = verifyBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setRepayBorrowVerify(bool verifyRepayBorrow_) public {
        verifyRepayBorrow = verifyRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setLiquidateBorrowVerify(bool verifyLiquidateBorrow_) public {
        verifyLiquidateBorrow = verifyLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setSeizeVerify(bool verifySeize_) public {
        verifySeize = verifySeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    function setTransferVerify(bool verifyTransfer_) public {
        verifyTransfer = verifyTransfer_;
    }

    /*** Liquidity/Liquidation Calculations ***/

    function setCalculatedSeizeTokens(uint seizeTokens_) public {
        calculatedSeizeTokens = seizeTokens_;
    }

    function setFailCalculateSeizeTokens(bool shouldFail) public {
        failCalculateSeizeTokens = shouldFail;
    }

    function setBUMCalculatedSeizeTokens(uint bumSeizeTokens_) public {
        bumCalculatedSeizeTokens = bumSeizeTokens_;
    }

    function setBUMFailCalculateSeizeTokens(bool bumShouldFail) public {
        bumFailCalculateSeizeTokens = bumShouldFail;
    }

    function harnessSetMintedBUMOf(address owner, uint amount) external returns (uint) {
        mintedBUMs[owner] = amount;
        return noError;
    }

    // function mintedBUMs(address owner) external pure returns (uint) {
    //     owner;
    //     return 1e18;
    // }

    function setMintedBUMOf(address owner, uint amount) external returns (uint) {
        owner;
        amount;
        return noError;
    }

    function bumMintRate() external pure returns (uint) {
        return 1e18;
    }

    function setTreasuryData(address treasuryGuardian_, address treasuryAddress_, uint treasuryPercent_) external {
        treasuryGuardian = treasuryGuardian_;
        treasuryAddress = treasuryAddress_;
        treasuryPercent = treasuryPercent_;
    }
}

contract EchoTypesComptroller is UnitrollerAdminStorage {
    function stringy(string memory s) public pure returns(string memory) {
        return s;
    }

    function addresses(address a) public pure returns(address) {
        return a;
    }

    function booly(bool b) public pure returns(bool) {
        return b;
    }

    function listOInts(uint[] memory u) public pure returns(uint[] memory) {
        return u;
    }

    function reverty() public pure {
        require(false, "gotcha sucka");
    }

    function becomeBrains(address payable unitroller) public {
        Unitroller(unitroller)._acceptImplementation();
    }
}
