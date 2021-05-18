const {
  maticMantissa,
  maticUnsigned
} = require('../Utils/BSC');
const {
  makeCToken,
  setBorrowRate
} = require('../Utils/ChumHum');

const blockNumber = 2e7;
const borrowIndex = 1e18;
const borrowRate = .000001;

async function pretendBlock(cToken, accrualBlock = blockNumber, deltaBlocks = 1) {
  await send(cToken, 'harnessSetAccrualBlockNumber', [maticUnsigned(blockNumber)]);
  await send(cToken, 'harnessSetBlockNumber', [maticUnsigned(blockNumber + deltaBlocks)]);
  await send(cToken, 'harnessSetBorrowIndex', [maticUnsigned(borrowIndex)]);
}

async function preAccrue(cToken) {
  await setBorrowRate(cToken, borrowRate);
  await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cToken, 'harnessExchangeRateDetails', [0, 0, 0]);
}

describe('CToken', () => {
  let root, accounts;
  let cToken;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    cToken = await makeCToken({comptrollerOpts: {kind: 'bool'}});
  });

  beforeEach(async () => {
    await preAccrue(cToken);
  });

  describe('accrueInterest', () => {
    it('reverts if the interest rate is absurdly high', async () => {
      await pretendBlock(cToken, blockNumber, 1);
      expect(await call(cToken, 'getBorrowRateMaxMantissa')).toEqualNumber(maticMantissa(0.000005)); // 0.0005% per block
      await setBorrowRate(cToken, 0.001e-2); // 0.0010% per block
      await expect(send(cToken, 'accrueInterest')).rejects.toRevert("revert borrow rate is absurdly high");
    });

    it('fails if new borrow rate calculation fails', async () => {
      await pretendBlock(cToken, blockNumber, 1);
      await send(cToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(send(cToken, 'accrueInterest')).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it('fails if simple interest factor calculation fails', async () => {
      await pretendBlock(cToken, blockNumber, 5e70);
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED');
    });

    it('fails if new borrow index calculation fails', async () => {
      await pretendBlock(cToken, blockNumber, 5e60);
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if new borrow interest index calculation fails', async () => {
      await pretendBlock(cToken)
      await send(cToken, 'harnessSetBorrowIndex', ['0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF']);
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if interest accumulated calculation fails', async () => {
      await send(cToken, 'harnessExchangeRateDetails', [0, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 0]);
      await pretendBlock(cToken)
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED');
    });

    it('fails if new total borrows calculation fails', async () => {
      await setBorrowRate(cToken, 1e-18);
      await pretendBlock(cToken)
      await send(cToken, 'harnessExchangeRateDetails', [0, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 0]);
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED');
    });

    it('fails if interest accumulated for reserves calculation fails', async () => {
      await setBorrowRate(cToken, .000001);
      await send(cToken, 'harnessExchangeRateDetails', [0, maticUnsigned(1e30), '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF']);
      await send(cToken, 'harnessSetReserveFactorFresh', [maticUnsigned(1e10)]);
      await pretendBlock(cToken, blockNumber, 5e20)
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('fails if new total reserves calculation fails', async () => {
      await setBorrowRate(cToken, 1e-18);
      await send(cToken, 'harnessExchangeRateDetails', [0, maticUnsigned(1e56), '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF']);
      await send(cToken, 'harnessSetReserveFactorFresh', [maticUnsigned(1e17)]);
      await pretendBlock(cToken)
      expect(await send(cToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('succeeds and saves updated values in storage on success', async () => {
      const startingTotalBorrows = 1e22;
      const startingTotalReserves = 1e20;
      const reserveFactor = 1e17;

      await send(cToken, 'harnessExchangeRateDetails', [0, maticUnsigned(startingTotalBorrows), maticUnsigned(startingTotalReserves)]);
      await send(cToken, 'harnessSetReserveFactorFresh', [maticUnsigned(reserveFactor)]);
      await pretendBlock(cToken)

      const expectedAccrualBlockNumber = blockNumber + 1;
      const expectedBorrowIndex = borrowIndex + borrowIndex * borrowRate;
      const expectedTotalBorrows = startingTotalBorrows + startingTotalBorrows * borrowRate;
      const expectedTotalReserves = startingTotalReserves + startingTotalBorrows *  borrowRate * reserveFactor / 1e18;

      const receipt = await send(cToken, 'accrueInterest')
      expect(receipt).toSucceed();
      expect(receipt).toHaveLog('AccrueInterest', {
        cashPrior: 0,
        interestAccumulated: maticUnsigned(expectedTotalBorrows).sub(maticUnsigned(startingTotalBorrows)),
        borrowIndex: maticUnsigned(expectedBorrowIndex),
        totalBorrows: maticUnsigned(expectedTotalBorrows)
      })
      expect(await call(cToken, 'accrualBlockNumber')).toEqualNumber(expectedAccrualBlockNumber);
      expect(await call(cToken, 'borrowIndex')).toEqualNumber(expectedBorrowIndex);
      expect(await call(cToken, 'totalBorrows')).toEqualNumber(expectedTotalBorrows);
      expect(await call(cToken, 'totalReserves')).toEqualNumber(expectedTotalReserves);
    });
  });
});
