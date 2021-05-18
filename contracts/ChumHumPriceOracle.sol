pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./PriceOracle.sol";
import "./CErc20.sol";
import "./ERC20Interface.sol";
import "./SafeMath.sol";

interface AggregatorV3Interface {

  function decimals() external view returns (uint8);
  function description() external view returns (string memory);
  function version() external view returns (uint256);

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(uint80 _roundId)
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

}

contract ChumHumPriceOracle is PriceOracle {
    using SafeMath for uint256;
    address public admin;

    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);
    
    event NewAdmin(address oldAdmin, address newAdmin);

    mapping(address => address) priceFeeds;
    event PriceFeedChanged(address asset, address previousPriceFeed, address newPriceFeed);
    constructor() public {
        priceFeeds[address(0)] = 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0;                                  // MATIC/USD
        priceFeeds[0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174] = 0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7;  // USDC/USD
        priceFeeds[0xc2132D05D31c914a87C6611C10748AEb04B58e8F] = 0x0A6513e40db6EB1b165753AD52E80663aeA50545;  // USDT/USD
        priceFeeds[0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6] = 0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6;  // WBTC/USD
        priceFeeds[0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619] = 0xF9680D99D6C9589e2a93a78A04A279e509205945;  // ETH/USD
        
        admin = msg.sender;
    }

    function getUnderlyingPrice(CToken cToken) public view returns (uint) {
        uint80 roundID ;
        int price;
        uint startedAt;
        uint timeStamp;
        uint80 answeredInRound;
        
        if (compareStrings(cToken.symbol(), "cMATIC")) {
            uint256 resultPrice;
            if(prices[address(0)] != 0) {
                resultPrice = prices[address(0)];
            } else {
                 (roundID, price, startedAt,timeStamp,answeredInRound) = AggregatorV3Interface(priceFeeds[address(0)]).latestRoundData();
                 resultPrice = uint256(price).mul(10**10);

            }
            return resultPrice;
        } else {
            uint256 resultPrice;
            ERC20Interface token = ERC20Interface(CErc20(address(cToken)).underlying());

            if(prices[address(token)] != 0) {
                resultPrice = prices[address(token)];
            } else {
                if(priceFeeds[address(token)] != address(0)){
                    (roundID, price, startedAt,timeStamp,answeredInRound) = AggregatorV3Interface(priceFeeds[address(token)]).latestRoundData();
                }
                else{
                    price = 0;
                }
                resultPrice = uint256(price).mul(10**10);
            }

            uint256 defaultDecimal = 18;
            uint256 tokenDecimal = uint256(token.decimals());

            if(defaultDecimal == tokenDecimal) {
                return resultPrice;
            } else if(defaultDecimal > tokenDecimal) {
                return resultPrice.mul(10**(defaultDecimal.sub(tokenDecimal)));
            } else {
                return resultPrice.div(10**(tokenDecimal.sub(defaultDecimal)));
            }
        }
    }

    function setUnderlyingPrice(CToken cToken, uint underlyingPriceMantissa) public {
        require(msg.sender == admin, "only admin can set underlying price");
        address asset = address(CErc20(address(cToken)).underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        require(msg.sender == admin, "only admin can set price");
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
    function setPriceFeed(address asset, address priceFeed) public {
        require(msg.sender == admin, "only admin can set price");
        emit PriceFeedChanged(asset, priceFeeds[asset], priceFeed);
        priceFeeds[asset] = priceFeed;
    }
    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "only admin can set new admin");
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }
}
