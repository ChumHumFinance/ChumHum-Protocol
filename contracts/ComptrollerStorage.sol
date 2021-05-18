pragma solidity ^0.5.16;

import "./CToken.sol";
import "./PriceOracle.sol";
import "./BUMControllerInterface.sol";

contract UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of Unitroller
    */
    address public comptrollerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingComptrollerImplementation;
}

contract ComptrollerV1Storage is UnitrollerAdminStorage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => CToken[]) public accountAssets;

    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives CHUM
        bool isChumHum;
    }

    /**
     * @notice Official mapping of cTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;

    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;

    struct ChumHumMarketState {
        /// @notice The market's last updated chumhumBorrowIndex or chumhumSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice A list of all markets
    CToken[] public allMarkets;

    /// @notice The rate at which the flywheel distributes CHUM, per block
    uint public chumhumRate;

    /// @notice The portion of chumhumRate that each market currently receives
    mapping(address => uint) public chumhumSpeeds;

    /// @notice The ChumHum market supply state for each market
    mapping(address => ChumHumMarketState) public chumhumSupplyState;

    /// @notice The ChumHum market borrow state for each market
    mapping(address => ChumHumMarketState) public chumhumBorrowState;

    /// @notice The ChumHum supply index for each market for each supplier as of the last time they accrued CHUM
    mapping(address => mapping(address => uint)) public chumhumSupplierIndex;

    /// @notice The ChumHum borrow index for each market for each borrower as of the last time they accrued CHUM
    mapping(address => mapping(address => uint)) public chumhumBorrowerIndex;

    /// @notice The CHUM accrued but not yet transferred to each user
    mapping(address => uint) public chumhumAccrued;

    /// @notice The Address of BUMController
    BUMControllerInterface public bumController;

    /// @notice The minted BUM amount to each user
    mapping(address => uint) public mintedBUMs;

    /// @notice BUM Mint Rate as a percentage
    uint public bumMintRate;

    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     */
    bool public mintBUMGuardianPaused;
    bool public repayBUMGuardianPaused;

    /**
     * @notice Pause/Unpause whole protocol actions
     */
    bool public protocolPaused;

    /// @notice The rate at which the flywheel distributes CHUM to BUM Minters, per block
    uint public chumhumBUMRate;
}

contract ComptrollerV2Storage is ComptrollerV1Storage {
    /// @notice The rate at which the flywheel distributes CHUM to BUM Vault, per block
    uint public chumhumBUMVaultRate;

    // address of BUM Vault
    address public bumVaultAddress;

    // start block of release to BUM Vault
    uint256 public releaseStartBlock;

    // minimum release amount to BUM Vault
    uint256 public minReleaseAmount;
}

contract ComptrollerV3Storage is ComptrollerV2Storage {
    /// @notice The borrowCapGuardian can set borrowCaps to any number for any market. Lowering the borrow cap could disable borrowing on the given market.
    address public borrowCapGuardian;

    /// @notice Borrow caps enforced by borrowAllowed for each cToken address. Defaults to zero which corresponds to unlimited borrowing.
    mapping(address => uint) public borrowCaps;
}

contract ComptrollerV4Storage is ComptrollerV3Storage {
    /// @notice Treasury Guardian address
    address public treasuryGuardian;

    /// @notice Treasury address
    address public treasuryAddress;

    /// @notice Fee percent of accrued interest with decimal 18
    uint256 public treasuryPercent;

    /// @notice Fee percent of accrued interest with decimal 18
    uint256 public treasuryChumPercent;
}
