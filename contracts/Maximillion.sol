pragma solidity ^0.5.16;

import "./CMATIC.sol";

/**
 * @title ChumHum's Maximillion Contract
 * @author ChumHum
 */
contract Maximillion {
    /**
     * @notice The default cMatic market to repay in
     */
    CMATIC public cMatic;

    /**
     * @notice Construct a Maximillion to repay max in a CMATIC market
     */
    constructor(CMATIC cMatic_) public {
        cMatic = cMatic_;
    }

    /**
     * @notice msg.sender sends MATIC to repay an account's borrow in the cMatic market
     * @dev The provided MATIC is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, cMatic);
    }

    /**
     * @notice msg.sender sends MATIC to repay an account's borrow in a cMatic market
     * @dev The provided MATIC is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param cMatic_ The address of the cMatic contract to repay in
     */
    function repayBehalfExplicit(address borrower, CMATIC cMatic_) public payable {
        uint received = msg.value;
        uint borrows = cMatic_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            cMatic_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            cMatic_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
