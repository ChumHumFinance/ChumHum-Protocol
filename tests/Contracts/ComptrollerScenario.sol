pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public chumAddress;
    address public bumAddress;

    constructor() Comptroller() public {}

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

    /**
     * @notice Recalculate and update CHUM speeds for all CHUM markets
     */
    function refreshChumHumSpeeds() public {
        CToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: cToken.borrowIndex()});
            updateChumHumSupplyIndex(address(cToken));
            updateChumHumBorrowIndex(address(cToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets_[i];
            if (chumhumSpeeds[address(cToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(cToken)});
                Exp memory utility = mul_(assetPrice, cToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            CToken cToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(chumhumRate, div_(utilities[i], totalUtility)) : 0;
            setChumHumSpeedInternal(cToken, newSpeed);
        }
    }
}
