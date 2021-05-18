pragma solidity ^0.5.16;

import "../../contracts/BUMController.sol";

contract BUMControllerHarness is BUMController {
    address bumAddress;
    uint public blockNumber;

    constructor() BUMController() public {}

    function setChumHumBUMState(uint224 index, uint32 blockNumber_) public {
        chumhumBUMState.index = index;
        chumhumBUMState.block = blockNumber_;
    }

    function setBUMAddress(address bumAddress_) public {
        bumAddress = bumAddress_;
    }

    function getBUMAddress() public view returns (address) {
        return bumAddress;
    }

    function setChumHumBUMMinterIndex(address bumMinter, uint index) public {
        chumhumBUMMinterIndex[bumMinter] = index;
    }

    function harnessUpdateChumHumBUMMintIndex() public {
        updateChumHumBUMMintIndex();
    }

    function harnessCalcDistributeBUMMinterChumHum(address bumMinter) public {
        calcDistributeBUMMinterChumHum(bumMinter);
    }

    function harnessRepayBUMFresh(address payer, address account, uint repayAmount) public returns (uint) {
       (uint err,) = repayBUMFresh(payer, account, repayAmount);
       return err;
    }

    function harnessLiquidateBUMFresh(address liquidator, address borrower, uint repayAmount, CToken cTokenCollateral) public returns (uint) {
        (uint err,) = liquidateBUMFresh(liquidator, borrower, repayAmount, cTokenCollateral);
        return err;
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }
}
