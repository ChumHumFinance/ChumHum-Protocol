const {
  makeComptroller,
  makeCToken
} = require('../Utils/ChumHum');
const {
  maticExp,
  maticDouble,
  maticUnsigned
} = require('../Utils/BSC');


// NB: coverage doesn't like this
describe.skip('Flywheel trace ops', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, market;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    market = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    await send(comptroller, '_addChumHumMarkets', [[market].map(c => c._address)]);
  });

  it('update supply index SSTOREs', async () => {
    await send(comptroller, 'setBlockNumber', [100]);
    await send(market, 'harnessSetTotalBorrows', [maticUnsigned(11e18)]);
    await send(comptroller, 'setChumHumSpeed', [market._address, maticExp(0.5)]);

    const tx = await send(comptroller, 'harnessUpdateChumHumSupplyIndex', [market._address]);

    const ops = {};
    await saddle.trace(tx, {
      execLog: log => {
        if (log.lastLog != undefined) {
          ops[log.op] = (ops[log.op] || []).concat(log);
        }
      }
    });
    expect(ops.SSTORE.length).toEqual(1);
  });

  it('update borrow index SSTOREs', async () => {
    await send(comptroller, 'setBlockNumber', [100]);
    await send(market, 'harnessSetTotalBorrows', [maticUnsigned(11e18)]);
    await send(comptroller, 'setChumHumSpeed', [market._address, maticExp(0.5)]);

    const tx = await send(comptroller, 'harnessUpdateChumHumBorrowIndex', [market._address, maticExp(1.1)]);

    const ops = {};
    await saddle.trace(tx, {
      execLog: log => {
        if (log.lastLog != undefined) {
          ops[log.op] = (ops[log.op] || []).concat(log);
        }
      }
    });
    expect(ops.SSTORE.length).toEqual(1);
  });
});