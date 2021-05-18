const {
  makeCToken,
} = require('../Utils/ChumHum');
  
describe('VChumLikeDelegate', function () {
  describe("_delegateChumLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts;
      const cToken = await makeCToken({kind: 'vchum'});
      await expect(send(cToken, '_delegateChumLikeTo', [a1], {from: a1})).rejects.toRevert('revert only the admin may set the chum-like delegate');
    });

    it("delegates successfully if the admin", async () => {
      const [root, a1] = saddle.accounts, amount = 1;
      const vCHUM = await makeCToken({kind: 'vchum'}), CHUM = vCHUM.underlying;
      const tx1 = await send(vCHUM, '_delegateChumLikeTo', [a1]);
      const tx2 = await send(CHUM, 'transfer', [vCHUM._address, amount]);
      await expect(await call(CHUM, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});
