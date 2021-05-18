pragma solidity ^0.5.16;

import "../../contracts/BUMController.sol";
import "./ComptrollerScenario.sol";

contract BUMControllerScenario is BUMController {
    uint blockNumber;
    address public chumAddress;
    address public bumAddress;

    constructor() BUMController() public {}

    function setBUMAddress(address bumAddress_) public {
        bumAddress = bumAddress_;
    }

    function getBUMAddress() public view returns (address) {
        return bumAddress;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }
}
