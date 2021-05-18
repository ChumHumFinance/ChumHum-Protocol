pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG1.sol";

contract ComptrollerScenarioG1 is ComptrollerG1 {
    uint public blockNumber;
    address public chumAddress;
    address public bumAddress;

    constructor() ComptrollerG1() public {}

    function setCHUMAddress(address chumAddress_) public {
        chumAddress = chumAddress_;
    }

    function getCHUMAddress() public view returns (address) {
        return chumAddress;
    }

    function setBUMAddress(address bumAddress_) public {
        bumAddress = bumAddress_;
    }

    function getBUMAddress() public view returns (address) {
        return bumAddress;
    }

    function membershipLength(CToken cToken) public view returns (uint) {
        return accountAssets[address(cToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
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
            if (markets[address(allMarkets[i])].isChumHum) {
                n++;
            }
        }

        address[] memory chumhumMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isChumHum) {
                chumhumMarkets[k++] = address(allMarkets[i]);
            }
        }
        return chumhumMarkets;
    }

    function unlist(CToken cToken) public {
        markets[address(cToken)].isListed = false;
    }
}
