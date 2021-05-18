const {maticUnsigned} = require('../Utils/BSC');
const {
  makeComptroller,
  makeCToken,
  setOraclePrice,
  setOraclePriceFromMantissa
} = require('../Utils/ChumHum');

const borrowedPrice = 1e18;
const collateralPrice = 1e18;
const repayAmount = maticUnsigned(1e18);

async function bumCalculateSeizeTokens(comptroller, cTokenCollateral, repayAmount) {
  return call(comptroller, 'liquidateBUMCalculateSeizeTokens', [cTokenCollateral._address, repayAmount]);
}

function rando(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

describe('Comptroller', () => {
  let root, accounts;
  let comptroller, bumcontroller, bum, cTokenCollateral;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    bumcontroller = comptroller.bumcontroller;
    bum = comptroller.bum;
    cTokenCollateral = await makeCToken({comptroller: comptroller, underlyingPrice: 0});
  });

  beforeEach(async () => {
    await setOraclePrice(cTokenCollateral, collateralPrice);
    await send(cTokenCollateral, 'harnessExchangeRateDetails', [8e10, 4e10, 0]);
  });

  describe('liquidateBUMCalculateAmountSeize', () => {
    it("fails if either asset price is 0", async () => {
      await setOraclePrice(cTokenCollateral, 0);
      expect(
        await bumCalculateSeizeTokens(comptroller, cTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);
    });

    it("fails if the repayAmount causes overflow ", async () => {
      await expect(
        bumCalculateSeizeTokens(comptroller, cTokenCollateral, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
      ).rejects.toRevert("revert multiplication overflow");
    });

    it("reverts if it fails to calculate the exchange rate", async () => {
      await send(cTokenCollateral, 'harnessExchangeRateDetails', [1, 0, 10]); // (1 - 10) -> underflow
      await expect(
        send(comptroller, 'liquidateBUMCalculateSeizeTokens', [cTokenCollateral._address, repayAmount])
      ).rejects.toRevert("revert exchangeRateStored: exchangeRateStoredInternal failed");
    });

    [
      [1e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 1e18, 1.42e18, 1.3e18, 2.45e18],
      [2.789e18, 1e18, 771.32e18, 1.3e18, 10002.45e18],
      [ 7.009232529961056e+24,1e18,2.6177112093242585e+23,1179713989619784000,7.790468414639561e+24 ],
      [rando(0, 1e25), 1e18, rando(1, 1e25), rando(1e18, 1.5e18), rando(0, 1e25)]
    ].forEach((testCase) => {
      it(`returns the correct value for ${testCase}`, async () => {
        const [exchangeRate, borrowedPrice, collateralPrice, liquidationIncentive, repayAmount] = testCase.map(maticUnsigned);

        await setOraclePriceFromMantissa(cTokenCollateral, collateralPrice);
        await send(comptroller, '_setLiquidationIncentive', [liquidationIncentive]);
        await send(cTokenCollateral, 'harnessSetExchangeRate', [exchangeRate]);

        const seizeAmount = repayAmount.mul(liquidationIncentive).mul(borrowedPrice).div(collateralPrice);
        const seizeTokens = seizeAmount.div(exchangeRate);

        expect(
          await bumCalculateSeizeTokens(comptroller, cTokenCollateral, repayAmount)
        ).toHaveTrollErrorTuple(
          ['NO_ERROR', Number(seizeTokens)],
          (x, y) => Math.abs(x - y) < 1e7
        );
      });
    });
  });
});
