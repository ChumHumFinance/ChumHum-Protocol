pragma solidity ^0.5.16;

import "./CBNB.sol";

/**
 * @title ChumHum's Maximillion Contract
 * @author ChumHum
 */
contract Maximillion {
    /**
     * @notice The default cBnb market to repay in
     */
    CBNB public cBnb;

    /**
     * @notice Construct a Maximillion to repay max in a CBNB market
     */
    constructor(CBNB cBnb_) public {
        cBnb = cBnb_;
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in the cBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, cBnb);
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in a cBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param cBnb_ The address of the cBnb contract to repay in
     */
    function repayBehalfExplicit(address borrower, CBNB cBnb_) public payable {
        uint received = msg.value;
        uint borrows = cBnb_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            cBnb_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            cBnb_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
