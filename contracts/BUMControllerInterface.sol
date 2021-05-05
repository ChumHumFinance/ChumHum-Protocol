pragma solidity ^0.5.16;

contract BUMControllerInterface {
    function getBUMAddress() public view returns (address);
    function getMintableBUM(address minter) public view returns (uint, uint);
    function mintBUM(address minter, uint mintBUMAmount) external returns (uint);
    function repayBUM(address repayer, uint repayBUMAmount) external returns (uint);

    function _initializeChumHumBUMState(uint blockNumber) external returns (uint);
    function updateChumHumBUMMintIndex() external returns (uint);
    function calcDistributeBUMMinterChumHum(address bumMinter) external returns(uint, uint, uint, uint);
}
