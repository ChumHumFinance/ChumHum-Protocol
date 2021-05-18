const {
  maticGasCost,
  maticUnsigned
} = require('../Utils/BSC');

const {
  makeCToken,
  fastForward,
  setBalance,
  setMintedBUMOf,
  setBUMBalance,
  getBalancesWithBUM,
  adjustBalancesWithBUM,
  pretendBorrow,
  pretendBUMMint,
  preApproveBUM
} = require('../Utils/ChumHum');

const repayAmount = maticUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced

async function preLiquidateBUM(comptroller, bumcontroller, bum, liquidator, borrower, repayAmount, cTokenCollateral) {
  // setup for success in liquidating
  await send(comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(comptroller, 'setRepayBorrowAllowed', [true]);
  await send(comptroller, 'setRepayBorrowVerify', [true]);
  await send(comptroller, 'setSeizeAllowed', [true]);
  await send(comptroller, 'setSeizeVerify', [true]);
  await send(comptroller, 'setBUMFailCalculateSeizeTokens', [false]);
  await send(cTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cTokenCollateral.comptroller, 'setBUMCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(cTokenCollateral, liquidator, 0);
  await setBalance(cTokenCollateral, borrower, seizeTokens);
  await setMintedBUMOf(comptroller, borrower, 40e2);
  await setBUMBalance(bum, borrower, 40e2);
  await setBUMBalance(bum, liquidator, 40e2);
  await pretendBorrow(cTokenCollateral, borrower, 0, 10e2, 0);
  await pretendBUMMint(comptroller, bumcontroller, bum, borrower, 40e2);
  await preApproveBUM(comptroller, bum, liquidator, bumcontroller._address, repayAmount);
}

async function liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral) {
  return send(bumcontroller, 'harnessLiquidateBUMFresh', [liquidator, borrower, repayAmount, cTokenCollateral._address]);
}

async function liquidateBUM(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(bumcontroller, 1);
  await fastForward(cTokenCollateral, 1);
  return send(bumcontroller, 'liquidateBUM', [borrower, repayAmount, cTokenCollateral._address], {from: liquidator});
}

async function seize(cToken, liquidator, borrower, seizeAmount) {
  return send(cToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('BUMController', function () {
  let root, liquidator, borrower, accounts;
  let cTokenCollateral;
  let comptroller, bumcontroller, bum;

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    cTokenCollateral = await makeCToken({comptrollerOpts: {kind: 'bool'}});
    comptroller = cTokenCollateral.comptroller;
    bumcontroller = comptroller.bumcontroller;
    await send(comptroller, 'setLiquidateBorrowAllowed', [false]);
    bum = comptroller.bum;
  });

  beforeEach(async () => {
    await preLiquidateBUM(comptroller, bumcontroller, bum, liquidator, borrower, repayAmount, cTokenCollateral);
  });

  describe('liquidateBUMFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).toHaveBUMTrollReject('BUM_LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).toSucceed();
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(bumcontroller);
      await fastForward(cTokenCollateral);
      expect(
        await liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).toHaveBUMTrollFailure('REJECTION', 'BUM_LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateBUMFresh(bumcontroller, borrower, borrower, repayAmount, cTokenCollateral)
      ).toHaveBUMTrollFailure('REJECTION', 'BUM_LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateBUMFresh(bumcontroller, liquidator, borrower, 0, cTokenCollateral)).toHaveBUMTrollFailure('REJECTION', 'BUM_LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      await send(comptroller, 'setBUMFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).rejects.toRevert('revert BUM_LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    // it("fails if repay fails", async () => {
    //   await send(comptroller, 'setRepayBorrowAllowed', [false]);
    //   expect(
    //     await liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
    //   ).toHaveBUMTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    // });

    it("reverts if seize fails", async () => {
      await send(comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("reverts if liquidateBorrowVerify fails", async() => {
      await send(comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits LiquidateBUM events", async () => {
      const beforeBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      const result = await liquidateBUMFresh(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral);
      const afterBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBUM', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        cTokenCollateral: cTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      // expect(result).toHaveLog(['Transfer', 0], {
      //   from: liquidator,
      //   to: bumcontroller._address,
      //   amount: repayAmount.toString()
      // });
      // expect(result).toHaveLog(['Transfer', 1], {
      //   from: borrower,
      //   to: liquidator,
      //   amount: seizeTokens.toString()
      // });

      expect(afterBalances).toEqual(await adjustBalancesWithBUM(beforeBalances, [
        [cTokenCollateral, liquidator, 'tokens', seizeTokens],
        [cTokenCollateral, borrower, 'tokens', -seizeTokens],
        [bum, liquidator, 'bum', -repayAmount]
      ], bum));
    });
  });

  describe('liquidateBUM', () => {
    // it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
    //   await send(cToken.interestRateModel, 'setFailBorrowRate', [true]);
    //   await expect(liquidateBUM(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    // });

    // it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
    //   await send(cTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
    //   await expect(liquidateBUM(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    // });

    it("returns error from liquidateBUMFresh without emitting any extra logs", async () => {
      expect(await liquidateBUM(bumcontroller, liquidator, borrower, 0, cTokenCollateral)).toHaveBUMTrollFailure('REJECTION', 'BUM_LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBUMFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      const result = await liquidateBUM(bumcontroller, liquidator, borrower, repayAmount, cTokenCollateral);
      const gasCost = await maticGasCost(result);
      const afterBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalancesWithBUM(beforeBalances, [
        [cTokenCollateral, liquidator, 'matic', -gasCost],
        [cTokenCollateral, liquidator, 'tokens', seizeTokens],
        [cTokenCollateral, borrower, 'tokens', -seizeTokens],
        [bum, liquidator, 'bum', -repayAmount]
      ], bum));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(cTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if cTokenBalances[borrower] < amount", async () => {
      await setBalance(cTokenCollateral, borrower, 1);
      expect(await seize(cTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if cTokenBalances[liquidator] overflows", async () => {
      await setBalance(cTokenCollateral, liquidator, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      expect(await seize(cTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      const result = await seize(cTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalancesWithBUM(bum, [cTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Transfer', {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalancesWithBUM(beforeBalances, [
        [cTokenCollateral, liquidator, 'tokens', seizeTokens],
        [cTokenCollateral, borrower, 'tokens', -seizeTokens]
      ], bum));
    });
  });
});
