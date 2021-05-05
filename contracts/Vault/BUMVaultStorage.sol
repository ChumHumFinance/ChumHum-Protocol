pragma solidity ^0.5.16;
import "./SafeMath.sol";
import "./IBEP20.sol";

contract BUMVaultAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of BUM Vault
    */
    address public bumVaultImplementation;

    /**
    * @notice Pending brains of BUM Vault
    */
    address public pendingBUMVaultImplementation;
}

contract BUMVaultStorage is BUMVaultAdminStorage {
    /// @notice The CHUM TOKEN!
    IBEP20 public chum;

    /// @notice The BUM TOKEN!
    IBEP20 public bum;

    /// @notice Guard variable for re-entrancy checks
    bool internal _notEntered;

    /// @notice CHUM balance of vault
    uint256 public chumBalance;

    /// @notice Accumulated CHUM per share
    uint256 public accCHUMPerShare;

    //// pending rewards awaiting anyone to update
    uint256 public pendingRewards;

    /// @notice Info of each user.
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    // Info of each user that stakes tokens.
    mapping(address => UserInfo) public userInfo;
}
