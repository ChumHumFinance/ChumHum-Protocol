const {
  maticGasCost,
  maticMantissa,
  maticUnsigned,
  sendFallback
} = require('../Utils/BSC');

const {
  makeCToken,
  balanceOf,
  fastForward,
  setBalance,
  setMATICBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/ChumHum');

const exchangeRate = 5;
const mintAmount = maticUnsigned(1e5);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = maticUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(cToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(cToken.comptroller, 'setMintAllowed', [true]);
  await send(cToken.comptroller, 'setMintVerify', [true]);
  await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cToken, 'harnessSetExchangeRate', [maticMantissa(exchangeRate)]);
}

async function mintExplicit(cToken, minter, mintAmount) {
  return send(cToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(cToken, minter, mintAmount) {
  return sendFallback(cToken, {from: minter, value: mintAmount});
}

async function preRedeem(cToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(cToken.comptroller, 'setRedeemAllowed', [true]);
  await send(cToken.comptroller, 'setRedeemVerify', [true]);
  await send(cToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(cToken, 'harnessSetExchangeRate', [maticMantissa(exchangeRate)]);
  await setMATICBalance(cToken, redeemAmount);
  await send(cToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(cToken, redeemer, redeemTokens);
}

async function redeemCTokens(cToken, redeemer, redeemTokens, redeemAmount) {
  return send(cToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(cToken, redeemer, redeemTokens, redeemAmount) {
  return send(cToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('CMATIC', () => {
  let root, minter, redeemer, accounts;
  let cToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    cToken = await makeCToken({kind: 'cmatic', comptrollerOpts: {kind: 'bool'}});
    await fastForward(cToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(cToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(cToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(cToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([cToken], [minter]);
        const receipt = await mint(cToken, minter, mintAmount);
        const afterBalances = await getBalances([cToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [cToken, 'matic', mintAmount],
          [cToken, 'tokens', mintTokens],
          [cToken, minter, 'matic', -mintAmount.add(await maticGasCost(receipt))],
          [cToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemCTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(cToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(cToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(cToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(cToken, redeemer, redeemTokens.mul(5), redeemAmount.mul(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(cToken);
        const beforeBalances = await getBalances([cToken], [redeemer]);
        const receipt = await redeem(cToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([cToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [cToken, 'matic', -redeemAmount],
          [cToken, 'tokens', -redeemTokens],
          [cToken, redeemer, 'matic', redeemAmount.sub(await maticGasCost(receipt))],
          [cToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
