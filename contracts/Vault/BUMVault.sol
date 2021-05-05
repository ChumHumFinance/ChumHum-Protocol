pragma solidity ^0.5.16;
import "./SafeBEP20.sol";
import "./IBEP20.sol";
import "./BUMVaultProxy.sol";
import "./BUMVaultStorage.sol";
import "./BUMVaultErrorReporter.sol";

contract BUMVault is BUMVaultStorage {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    /// @notice Event emitted when BUM deposit
    event Deposit(address indexed user, uint256 amount);

    /// @notice Event emitted when BUM withrawal
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Event emitted when admin changed
    event AdminTransfered(address indexed oldAdmin, address indexed newAdmin);

    constructor() public {
        admin = msg.sender;
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

    /**
     * @notice Deposit BUM to BUMVault for CHUM allocation
     * @param _amount The amount to deposit to vault
     */
    function deposit(uint256 _amount) public nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        updateVault();

        // Transfer pending tokens to user
        updateAndPayOutPending(msg.sender);

        // Transfer in the amounts from user
        if(_amount > 0) {
            bum.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(accCHUMPerShare).div(1e18);
        emit Deposit(msg.sender, _amount);
    }

    /**
     * @notice Withdraw BUM from BUMVault
     * @param _amount The amount to withdraw from vault
     */
    function withdraw(uint256 _amount) public nonReentrant {
        _withdraw(msg.sender, _amount);
    }

    /**
     * @notice Claim CHUM from BUMVault
     */
    function claim() public nonReentrant {
        _withdraw(msg.sender, 0);
    }

    /**
     * @notice Low level withdraw function
     * @param account The account to withdraw from vault
     * @param _amount The amount to withdraw from vault
     */
    function _withdraw(address account, uint256 _amount) internal {
        UserInfo storage user = userInfo[account];
        require(user.amount >= _amount, "withdraw: not good");

        updateVault();
        updateAndPayOutPending(account); // Update balances of account this is not withdrawal but claiming CHUM farmed

        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            bum.safeTransfer(address(account), _amount);
        }
        user.rewardDebt = user.amount.mul(accCHUMPerShare).div(1e18);

        emit Withdraw(account, _amount);
    }

    /**
     * @notice View function to see pending CHUM on frontend
     * @param _user The user to see pending CHUM
     */
    function pendingCHUM(address _user) public view returns (uint256)
    {
        UserInfo storage user = userInfo[_user];

        return user.amount.mul(accCHUMPerShare).div(1e18).sub(user.rewardDebt);
    }

    /**
     * @notice Update and pay out pending CHUM to user
     * @param account The user to pay out
     */
    function updateAndPayOutPending(address account) internal {
        uint256 pending = pendingCHUM(account);

        if(pending > 0) {
            safeCHUMTransfer(account, pending);
        }
    }

    /**
     * @notice Safe CHUM transfer function, just in case if rounding error causes pool to not have enough CHUM
     * @param _to The address that CHUM to be transfered
     * @param _amount The amount that CHUM to be transfered
     */
    function safeCHUMTransfer(address _to, uint256 _amount) internal {
        uint256 chumBal = chum.balanceOf(address(this));

        if (_amount > chumBal) {
            chum.transfer(_to, chumBal);
            chumBalance = chum.balanceOf(address(this));
        } else {
            chum.transfer(_to, _amount);
            chumBalance = chum.balanceOf(address(this));
        }
    }

    /**
     * @notice Function that updates pending rewards
     */
    function updatePendingRewards() public {
        uint256 newRewards = chum.balanceOf(address(this)).sub(chumBalance);

        if(newRewards > 0) {
            chumBalance = chum.balanceOf(address(this)); // If there is no change the balance didn't change
            pendingRewards = pendingRewards.add(newRewards);
        }
    }

    /**
     * @notice Update reward variables to be up-to-date
     */
    function updateVault() internal {
        uint256 bumBalance = bum.balanceOf(address(this));
        if (bumBalance == 0) { // avoids division by 0 errors
            return;
        }

        accCHUMPerShare = accCHUMPerShare.add(pendingRewards.mul(1e18).div(bumBalance));
        pendingRewards = 0;
    }

    /**
     * @dev Returns the address of the current admin
     */
    function getAdmin() public view returns (address) {
        return admin;
    }

    /**
     * @dev Burn the current admin
     */
    function burnAdmin() public onlyAdmin {
        emit AdminTransfered(admin, address(0));
        admin = address(0);
    }

    /**
     * @dev Set the current admin to new address
     */
    function setNewAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "new owner is the zero address");
        emit AdminTransfered(admin, newAdmin);
        admin = newAdmin;
    }

    /*** Admin Functions ***/

    function _become(BUMVaultProxy bumVaultProxy) public {
        require(msg.sender == bumVaultProxy.admin(), "only proxy admin can change brains");
        require(bumVaultProxy._acceptImplementation() == 0, "change not authorized");
    }

    function setChumHumInfo(address _chum, address _bum) public onlyAdmin {
        chum = IBEP20(_chum);
        bum = IBEP20(_bum);

        _notEntered = true;
    }
}
