const {
  makeComptroller,
  makeCToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/ChumHum');
const {
  maticExp,
  maticDouble,
  maticUnsigned
} = require('../Utils/BSC');

const chumhumRate = maticUnsigned(1e18);

async function chumhumAccrued(comptroller, user) {
  return maticUnsigned(await call(comptroller, 'chumhumAccrued', [user]));
}

async function chumBalance(comptroller, user) {
  return maticUnsigned(await call(comptroller.chum, 'balanceOf', [user]))
}

async function totalChumHumAccrued(comptroller, user) {
  return (await chumhumAccrued(comptroller, user)).add(await chumBalance(comptroller, user));
}

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, cLOW, cREP, cZRX, cEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    cLOW = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    cREP = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    cZRX = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    cEVIL = await makeCToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('getChumHumMarkets()', () => {
    it('should return the chumhum markets', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      }
      expect(await call(comptroller, 'getChumHumMarkets')).toEqual(
        [cLOW, cREP, cZRX].map((c) => c._address)
      );
    });
  });

  describe('_setChumHumSpeed()', () => {
    it('should update market index when calling setChumHumSpeed', async () => {
      const mkt = cREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [maticUnsigned(10e18)]);

      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(1)]);

      const {index, block} = await call(comptroller, 'chumhumSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a chum market if called by admin', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      }
      const tx = await send(comptroller, '_setChumHumSpeed', [cLOW._address, 0]);
      expect(await call(comptroller, 'getChumHumMarkets')).toEqual(
        [cREP, cZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('ChumHumSpeedUpdated', {
        cToken: cLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a chum market from middle of array', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      }
      await send(comptroller, '_setChumHumSpeed', [cREP._address, 0]);
      expect(await call(comptroller, 'getChumHumMarkets')).toEqual(
        [cLOW, cZRX].map((c) => c._address)
      );
    });

    it('should not drop a chum market unless called by admin', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setChumHumSpeed', [cLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set chumhum speed');
    });

    it('should not add non-listed markets', async () => {
      const cBAT = await makeCToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddChumHumMarkets', [[cBAT._address]])
      ).rejects.toRevert('revert chumhum market is not listed');

      const markets = await call(comptroller, 'getChumHumMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateChumHumBorrowIndex()', () => {
    it('should calculate chum borrower index correctly', async () => {
      const mkt = cREP;
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [maticUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateChumHumBorrowIndex', [
        mkt._address,
        maticExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        chumhumAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + chumhumAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'chumhumBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update chumhumBorrowState index if cToken not in ChumHum markets', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addChumHumMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateChumHumBorrowIndex', [
        mkt._address,
        maticExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'chumhumBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'chumhumSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = cREP;
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await send(comptroller, 'harnessUpdateChumHumBorrowIndex', [
        mkt._address,
        maticExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'chumhumBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if chumhum speed is 0', async () => {
      const mkt = cREP;
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0)]);
      await send(comptroller, 'harnessUpdateChumHumBorrowIndex', [
        mkt._address,
        maticExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'chumhumBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateChumHumSupplyIndex()', () => {
    it('should calculate chum supplier index correctly', async () => {
      const mkt = cREP;
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [maticUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateChumHumSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        chumhumAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += chumhumAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'chumhumSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-ChumHum markets', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addChumHumMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateChumHumSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'chumhumSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'chumhumSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // ctoken could have no chumhum speed or chum supplier state if not in chumhum markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = cREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [maticUnsigned(10e18)]);
      await send(comptroller, '_setChumHumSpeed', [mkt._address, maticExp(0.5)]);
      await send(comptroller, 'harnessUpdateChumHumSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'chumhumSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const chumhumRemaining = chumhumRate.mul(100)
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');

      await quickMint(cLOW, a2, maticUnsigned(10e18));
      await quickMint(cLOW, a3, maticUnsigned(15e18));

      const a2Accrued0 = await totalChumHumAccrued(comptroller, a2);
      const a3Accrued0 = await totalChumHumAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(cLOW, a2);
      const a3Balance0 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(cLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalChumHumAccrued(comptroller, a2);
      const a3Accrued1 = await totalChumHumAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(cLOW, a2);
      const a3Balance1 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateChumHumSupplyIndex', [cLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(cLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalChumHumAccrued(comptroller, a2);
      const a3Accrued2 = await totalChumHumAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(220000);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerChumHum()', () => {

    it('should update borrow index checkpoint but not chumhumAccrued for first time user', async () => {
      const mkt = cREP;
      await send(comptroller, "setChumHumBorrowState", [mkt._address, maticDouble(6), 10]);
      await send(comptroller, "setChumHumBorrowerIndex", [mkt._address, root, maticUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerChumHum", [mkt._address, root, maticExp(1.1)]);
      expect(await call(comptroller, "chumhumAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "chumhumBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer chum and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = cREP;
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, maticUnsigned(5.5e18), maticExp(1)]);
      await send(comptroller, "setChumHumBorrowState", [mkt._address, maticDouble(6), 10]);
      await send(comptroller, "setChumHumBorrowerIndex", [mkt._address, a1, maticDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 chumhumBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 CHUM
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerChumHum", [mkt._address, a1, maticUnsigned(1.1e18)]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerChumHum', {
        cToken: mkt._address,
        borrower: a1,
        chumhumDelta: maticUnsigned(25e18).toString(),
        chumhumBorrowIndex: maticDouble(6).toString()
      });
    });

    it('should not transfer chum automatically', async () => {
      const mkt = cREP;
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, maticUnsigned(5.5e17), maticExp(1)]);
      await send(comptroller, "setChumHumBorrowState", [mkt._address, maticDouble(1.0019), 10]);
      await send(comptroller, "setChumHumBorrowerIndex", [mkt._address, a1, maticDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < chumhumClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerChumHum", [mkt._address, a1, maticExp(1.1)]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-ChumHum market', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addChumHumMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerChumHum", [mkt._address, a1, maticExp(1.1)]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'chumhumBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierChumHum()', () => {
    it('should transfer chum and update supply index correctly for first time user', async () => {
      const mkt = cREP;
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, maticUnsigned(5e18)]);
      await send(comptroller, "setChumHumSupplyState", [mkt._address, maticDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 chumhumSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 CHUM:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierChumHum", [mkt._address, a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierChumHum', {
        cToken: mkt._address,
        supplier: a1,
        chumhumDelta: maticUnsigned(25e18).toString(),
        chumhumSupplyIndex: maticDouble(6).toString()
      });
    });

    it('should update chum accrued and supply index for repeat user', async () => {
      const mkt = cREP;
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, maticUnsigned(5e18)]);
      await send(comptroller, "setChumHumSupplyState", [mkt._address, maticDouble(6), 10]);
      await send(comptroller, "setChumHumSupplierIndex", [mkt._address, a1, maticDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

     await send(comptroller, "harnessDistributeAllSupplierChumHum", [mkt._address, a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when chumhumAccrued below threshold', async () => {
      const mkt = cREP;
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, maticUnsigned(5e17)]);
      await send(comptroller, "setChumHumSupplyState", [mkt._address, maticDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierChumHum", [mkt._address, a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-ChumHum market', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addChumHumMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierChumHum", [mkt._address, a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'chumhumBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferCHUM', () => {
    it('should transfer chum accrued when amount is above threshold', async () => {
      const chumhumRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const chumBalancePre = await chumBalance(comptroller, a1);
      const tx0 = await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      const tx1 = await send(comptroller, 'setChumHumAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferChumHum', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await chumhumAccrued(comptroller, a1);
      const chumBalancePost = await chumBalance(comptroller, a1);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when chum accrued is below threshold', async () => {
      const chumhumRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const chumBalancePre = await call(comptroller.chum, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      const tx1 = await send(comptroller, 'setChumHumAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferChumHum', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await chumhumAccrued(comptroller, a1);
      const chumBalancePost = await chumBalance(comptroller, a1);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(0);
    });

    it('should not transfer chum if chum accrued is greater than chum remaining', async () => {
      const chumhumRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const chumBalancePre = await chumBalance(comptroller, a1);
      const tx0 = await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      const tx1 = await send(comptroller, 'setChumHumAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferChumHum', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await chumhumAccrued(comptroller, a1);
      const chumBalancePost = await chumBalance(comptroller, a1);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(0);
    });
  });

  describe('claimChumHum', () => {
    it('should accrue chum and then transfer chum accrued', async () => {
      const chumhumRemaining = chumhumRate.mul(100), mintAmount = maticUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, '_setChumHumSpeed', [cLOW._address, maticExp(0.5)]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');
      const speed = await call(comptroller, 'chumhumSpeeds', [cLOW._address]);
      const a2AccruedPre = await chumhumAccrued(comptroller, a2);
      const chumBalancePre = await chumBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimChumHum', [a2]);
      const a2AccruedPost = await chumhumAccrued(comptroller, a2);
      const chumBalancePost = await chumBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(chumhumRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(chumhumRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue chum and then transfer chum accrued in a single market', async () => {
      const chumhumRemaining = chumhumRate.mul(100), mintAmount = maticUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');
      const speed = await call(comptroller, 'chumhumSpeeds', [cLOW._address]);
      const a2AccruedPre = await chumhumAccrued(comptroller, a2);
      const chumBalancePre = await chumBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimChumHum', [a2, [cLOW._address]]);
      const a2AccruedPost = await chumhumAccrued(comptroller, a2);
      const chumBalancePost = await chumBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(220000);
      expect(speed).toEqualNumber(chumhumRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(chumhumRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when chum accrued is below threshold', async () => {
      const chumhumRemaining = maticExp(1), accruedAmt = maticUnsigned(0.0009e18)
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      await send(comptroller, 'setChumHumAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimChumHum', [a1, [cLOW._address]]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeCToken({comptroller});
      await expect(
        send(comptroller, 'claimChumHum', [a1, [cNOT._address]])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('claimChumHum batch', () => {
    it('should revert when claiming chum from non-listed market', async () => {
      const chumhumRemaining = chumhumRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10);
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(cLOW, root, 1, 1, maticExp(10));
      await send(comptroller, 'harnessRefreshChumHumSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimChumHum', [claimAccts, [cLOW._address, cEVIL._address], true, true])).rejects.toRevert('revert not listed market');
    });

    it('should claim the expected amount when holders and ctokens arg is duplicated', async () => {
      const chumhumRemaining = chumhumRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10);
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, maticExp(10));
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimChumHum', [[...claimAccts, ...claimAccts], [cLOW._address, cLOW._address], false, true]);
      // chum distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'chumhumSupplierIndex', [cLOW._address, acct])).toEqualNumber(maticDouble(1.125));
        expect(await chumBalance(comptroller, acct)).toEqualNumber(maticExp(1.25));
      }
    });

    it('claims chum for multiple suppliers only', async () => {
      const chumhumRemaining = chumhumRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10);
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, maticExp(10));
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimChumHum', [claimAccts, [cLOW._address], false, true]);
      // chum distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'chumhumSupplierIndex', [cLOW._address, acct])).toEqualNumber(maticDouble(1.125));
        expect(await chumBalance(comptroller, acct)).toEqualNumber(maticExp(1.25));
      }
    });

    it('claims chum for multiple borrowers only, primes uninitiated', async () => {
      const chumhumRemaining = chumhumRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10), borrowAmt = maticExp(1), borrowIdx = maticExp(1)
      await send(comptroller.chum, 'transfer', [comptroller._address, chumhumRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(cLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(cLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimChumHum', [claimAccts, [cLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'chumhumBorrowerIndex', [cLOW._address, acct])).toEqualNumber(maticDouble(2.25));
        expect(await call(comptroller, 'chumhumSupplierIndex', [cLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeCToken({comptroller});
      await expect(
        send(comptroller, 'claimChumHum', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('harnessRefreshChumHumSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshChumHumSpeeds');
      const speed = await call(comptroller, 'chumhumSpeeds', [cLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshChumHumSpeeds');
      const speed = await call(comptroller, 'chumhumSpeeds', [cLOW._address]);
      expect(speed).toEqualNumber(chumhumRate);
      expect(tx).toHaveLog(['ChumHumSpeedUpdated', 0], {
        cToken: cLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await pretendBorrow(cZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address, cZRX._address]]);
      await send(comptroller, 'harnessRefreshChumHumSpeeds');
      const speed1 = await call(comptroller, 'chumhumSpeeds', [cLOW._address]);
      const speed2 = await call(comptroller, 'chumhumSpeeds', [cREP._address]);
      const speed3 = await call(comptroller, 'chumhumSpeeds', [cZRX._address]);
      expect(speed1).toEqualNumber(chumhumRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(chumhumRate.div(4).mul(3));
    });
  });

  describe('harnessAddChumHumMarkets', () => {
    it('should correctly add a chumhum market if called by admin', async () => {
      const cBAT = await makeCToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddChumHumMarkets', [[cLOW._address, cREP._address, cZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddChumHumMarkets', [[cBAT._address]]);
      const markets = await call(comptroller, 'getChumHumMarkets');
      expect(markets).toEqual([cLOW, cREP, cZRX, cBAT].map((c) => c._address));
      expect(tx2).toHaveLog('ChumHumSpeedUpdated', {
        cToken: cBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = cLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = maticUnsigned(1.5e36);

      await send(comptroller, "harnessAddChumHumMarkets", [[mkt]]);
      await send(comptroller, "setChumHumSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setChumHumBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setChumHumSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddChumHumMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'chumhumSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'chumhumBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });
});
