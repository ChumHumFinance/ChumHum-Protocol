pragma solidity ^0.5.16;

import "./ComptrollerInterface.sol";

contract BUMUnitrollerAdminStorage {
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
    address public bumControllerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingBUMControllerImplementation;
}

contract BUMControllerStorageG1 is BUMUnitrollerAdminStorage {
    ComptrollerInterface public comptroller;

    struct ChumHumBUMState {
        /// @notice The last updated chumhumBUMMintIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice The ChumHum BUM state
    ChumHumBUMState public chumhumBUMState;

    /// @notice The ChumHum BUM state initialized
    bool public isChumHumBUMInitialized;

    /// @notice The ChumHum BUM minter index as of the last time they accrued CHUM
    mapping(address => uint) public chumhumBUMMinterIndex;
}

contract BUMControllerStorageG2 is BUMControllerStorageG1 {
    /// @notice Treasury Guardian address
    address public treasuryGuardian;

    /// @notice Treasury address
    address public treasuryAddress;

    /// @notice Fee percent of accrued interest with decimal 18
    uint256 public treasuryPercent;

    /// @notice Guard variable for re-entrancy checks
    bool internal _notEntered;
}
