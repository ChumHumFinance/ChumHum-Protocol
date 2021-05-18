pragma solidity ^0.5.16;

import "./SafeMath.sol";
import "./ERC20Interface.sol";
import "./Ownable.sol";

/**
 * @dev Contract for treasury all tokens as fee and transfer to governance
 */
contract CTreasury is Ownable {
    using SafeMath for uint256;

    // WithdrawTreasuryERC20 Event
    event WithdrawTreasuryERC20(address tokenAddress, uint256 withdrawAmount, address withdrawAddress);

    // WithdrawTreasuryMATIC Event
    event WithdrawTreasuryMATIC(uint256 withdrawAmount, address withdrawAddress);

    /**
     * @notice To receive MATIC
     */
    function () external payable {}

    /**
    * @notice Withdraw Treasury ERC20 Tokens, Only owner call it
    * @param tokenAddress The address of treasury token
    * @param withdrawAmount The withdraw amount to owner
    * @param withdrawAddress The withdraw address
    */
    function withdrawTreasuryERC20(
      address tokenAddress,
      uint256 withdrawAmount,
      address withdrawAddress
    ) external onlyOwner {
        uint256 actualWithdrawAmount = withdrawAmount;
        // Get Treasury Token Balance
        uint256 treasuryBalance = ERC20Interface(tokenAddress).balanceOf(address(this));

        // Check Withdraw Amount
        if (withdrawAmount > treasuryBalance) {
            // Update actualWithdrawAmount
            actualWithdrawAmount = treasuryBalance;
        }

        // Transfer ERC20 Token to withdrawAddress
        ERC20Interface(tokenAddress).transfer(withdrawAddress, actualWithdrawAmount);

        emit WithdrawTreasuryERC20(tokenAddress, actualWithdrawAmount, withdrawAddress);
    }

    /**
    * @notice Withdraw Treasury MATIC, Only owner call it
    * @param withdrawAmount The withdraw amount to owner
    * @param withdrawAddress The withdraw address
    */
    function withdrawTreasuryMATIC(
      uint256 withdrawAmount,
      address payable withdrawAddress
    ) external payable onlyOwner {
        uint256 actualWithdrawAmount = withdrawAmount;
        // Get Treasury MATIC Balance
        uint256 maticBalance = address(this).balance;

        // Check Withdraw Amount
        if (withdrawAmount > maticBalance) {
            // Update actualWithdrawAmount
            actualWithdrawAmount = maticBalance;
        }
        // Transfer MATIC to withdrawAddress
        withdrawAddress.transfer(actualWithdrawAmount);

        emit WithdrawTreasuryMATIC(actualWithdrawAmount, withdrawAddress);
    }
}
