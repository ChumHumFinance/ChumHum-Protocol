const {
  makeComptroller,
  makeBUM,
  balanceOf,
  fastForward,
  pretendBUMMint,
  quickMint,
  quickMintBUM
} = require('../Utils/ChumHum');
const {
  maticExp,
  maticDouble,
  maticUnsigned
} = require('../Utils/BSC');

const chumhumBUMRate = maticUnsigned(5e17);

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
  let comptroller, bumcontroller, bum;
  beforeEach(async () => {
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    bum = comptroller.bum;
    bumcontroller = comptroller.bumunitroller;
  });

  describe('updateChumHumBUMMintIndex()', () => {
    it('should calculate chum bum minter index correctly', async () => {
      await send(bumcontroller, 'setBlockNumber', [100]);
      await send(bum, 'harnessSetTotalSupply', [maticUnsigned(10e18)]);
      await send(comptroller, '_setChumHumBUMRate', [maticExp(0.5)]);
      await send(bumcontroller, 'harnessUpdateChumHumBUMMintIndex');
      /*
        bumTokens = 10e18
        chumhumAccrued = deltaBlocks * setChumHumBUMRate
                    = 100 * 0.5e18 = 50e18
        newIndex   += chumhumAccrued * 1e36 / bumTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(bumcontroller, 'chumhumBUMState');
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      await send(bumcontroller, 'harnessUpdateChumHumBUMMintIndex');

      const {index, block} = await call(bumcontroller, 'chumhumBUMState');
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });
  });

  describe('distributeBUMMinterChumHum()', () => {
    it('should update bum minter index checkpoint but not chumhumAccrued for first time user', async () => {
      await send(bumcontroller, "setChumHumBUMState", [maticDouble(6), 10]);
      await send(bumcontroller, "setChumHumBUMMinterIndex", [root, maticUnsigned(0)]);

      await send(comptroller, "harnessDistributeBUMMinterChumHum", [root]);
      expect(await call(comptroller, "chumhumAccrued", [root])).toEqualNumber(0);
      expect(await call(bumcontroller, "chumhumBUMMinterIndex", [root])).toEqualNumber(6e36);
    });

    it('should transfer chum and update bum minter index checkpoint correctly for repeat time user', async () => {
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});
      await send(bum, "harnessSetBalanceOf", [a1, maticUnsigned(5e18)]);
      await send(comptroller, "harnessSetMintedBUMs", [a1, maticUnsigned(5e18)]);
      await send(bumcontroller, "setChumHumBUMState", [maticDouble(6), 10]);
      await send(bumcontroller, "setChumHumBUMMinterIndex", [a1, maticDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total bum mint, 0.5e18 bumMinterSpeed => 6e18 chumhumBUMMintIndex
      * this tests that an acct with half the total bum mint over that time gets 25e18 CHUM
        bumMinterAmount = bumBalance * 1e18
                       = 5e18 * 1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        bumMinterAccrued= bumMinterAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBUMMinterChumHum", [a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBUMMinterChumHum', {
        bumMinter: a1,
        chumhumDelta: maticUnsigned(25e18).toString(),
        chumhumBUMMintIndex: maticDouble(6).toString()
      });
    });

    it('should not transfer if below chum claim threshold', async () => {
      await send(comptroller.chum, 'transfer', [comptroller._address, maticUnsigned(50e18)], {from: root});

      await send(bum, "harnessSetBalanceOf", [a1, maticUnsigned(5e17)]);
      await send(comptroller, "harnessSetMintedBUMs", [a1, maticUnsigned(5e17)]);
      await send(bumcontroller, "setChumHumBUMState", [maticDouble(1.0019), 10]);
      /*
        bumMinterAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        bumMintedAccrued+= bumMinterTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeBUMMinterChumHum", [a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(0);
    });
  });

  describe('claimChumHum', () => {
    it('should accrue chum and then transfer chum accrued', async () => {
      const chumRemaining = chumhumBUMRate.mul(100), mintAmount = maticUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.chum, 'transfer', [comptroller._address, chumRemaining], {from: root});
      //await pretendBUMMint(bum, a1, 1);
      const speed = await call(comptroller, 'chumhumBUMRate');
      const a2AccruedPre = await chumhumAccrued(comptroller, a2);
      const chumBalancePre = await chumBalance(comptroller, a2);
      await quickMintBUM(comptroller, bum, a2, mintAmount);
      await fastForward(bumcontroller, deltaBlocks);
      const tx = await send(comptroller, 'claimChumHum', [a2]);
      const a2AccruedPost = await chumhumAccrued(comptroller, a2);
      const chumBalancePost = await chumBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(chumhumBUMRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(chumBalancePre).toEqualNumber(0);
      expect(chumBalancePost).toEqualNumber(chumhumBUMRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when chum accrued is below threshold', async () => {
      const chumRemaining = maticExp(1), accruedAmt = maticUnsigned(0.0009e18)
      await send(comptroller.chum, 'transfer', [comptroller._address, chumRemaining], {from: root});
      await send(comptroller, 'setChumHumAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimChumHum', [a1]);
      expect(await chumhumAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await chumBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });
  });

  describe('claimChumHum batch', () => {
    it('should claim the expected amount when holders and arg is duplicated', async () => {
      const chumRemaining = chumhumBUMRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10);
      await send(comptroller.chum, 'transfer', [comptroller._address, chumRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        await send(bum, 'harnessIncrementTotalSupply', [mintAmount]);
        expect(await send(bum, 'harnessSetBalanceOf', [from, mintAmount], { from })).toSucceed();
        expect(await await send(comptroller, 'harnessSetMintedBUMs', [from, mintAmount], { from })).toSucceed();
      }
      await fastForward(bumcontroller, deltaBlocks);

      const tx = await send(comptroller, 'claimChumHum', [[...claimAccts, ...claimAccts], [], false, false]);
      // chum distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(bumcontroller, 'chumhumBUMMinterIndex', [acct])).toEqualNumber(maticDouble(1.0625));
        expect(await chumBalance(comptroller, acct)).toEqualNumber(maticExp(0.625));
      }
    });

    it('claims chum for multiple bum minters only, primes uninitiated', async () => {
      const chumRemaining = chumhumBUMRate.mul(100), deltaBlocks = 10, mintAmount = maticExp(10), bumAmt = maticExp(1), bumMintIdx = maticExp(1)
      await send(comptroller.chum, 'transfer', [comptroller._address, chumRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(bum, 'harnessIncrementTotalSupply', [bumAmt]);
        await send(bum, 'harnessSetBalanceOf', [acct, bumAmt]);
        await send(comptroller, 'harnessSetMintedBUMs', [acct, bumAmt]);
      }

      await send(bumcontroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimChumHum', [claimAccts, [], false, false]);
      for(let acct of claimAccts) {
        expect(await call(bumcontroller, 'chumhumBUMMinterIndex', [acct])).toEqualNumber(maticDouble(1.625));
      }
    });
  });

  describe('_setChumHumBUMRate', () => {
    it('should correctly change chumhum bum rate if called by admin', async () => {
      expect(await call(comptroller, 'chumhumBUMRate')).toEqualNumber(chumhumBUMRate);
      const tx1 = await send(comptroller, '_setChumHumBUMRate', [maticUnsigned(3e18)]);
      expect(await call(comptroller, 'chumhumBUMRate')).toEqualNumber(maticUnsigned(3e18));
      const tx2 = await send(comptroller, '_setChumHumBUMRate', [maticUnsigned(2e18)]);
      expect(await call(comptroller, 'chumhumBUMRate')).toEqualNumber(maticUnsigned(2e18));
      expect(tx2).toHaveLog('NewChumHumBUMRate', {
        oldChumHumBUMRate: maticUnsigned(3e18),
        newChumHumBUMRate: maticUnsigned(2e18)
      });
    });

    it('should not change chumhum bum rate unless called by admin', async () => {
      await expect(
        send(comptroller, '_setChumHumBUMRate', [maticUnsigned(1e18)], {from: a1})
      ).rejects.toRevert('revert only admin can');
    });
  });
});
