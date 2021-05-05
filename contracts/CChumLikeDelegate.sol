pragma solidity ^0.5.16;

import "./CBep20Delegate.sol";

interface ChumLike {
  function delegate(address delegatee) external;
}

/**
 * @title ChumHum's VChumLikeDelegate Contract
 * @notice CTokens which can 'delegate votes' of their underlying BEP-20
 * @author ChumHum
 */
contract VChumLikeDelegate is CBep20Delegate {
  /**
   * @notice Construct an empty delegate
   */
  constructor() public CBep20Delegate() {}

  /**
   * @notice Admin call to delegate the votes of the CHUM-like underlying
   * @param chumLikeDelegatee The address to delegate votes to
   */
  function _delegateChumLikeTo(address chumLikeDelegatee) external {
    require(msg.sender == admin, "only the admin may set the chum-like delegate");
    ChumLike(underlying).delegate(chumLikeDelegatee);
  }
}