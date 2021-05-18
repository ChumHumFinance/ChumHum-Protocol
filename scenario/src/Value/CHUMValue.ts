import { Event } from '../Event';
import { World } from '../World';
import { CHUM } from '../Contract/CHUM';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getCHUM } from '../ContractLookup';

export function chumFetchers() {
  return [
    new Fetcher<{ chum: CHUM }, AddressV>(`
        #### Address

        * "<CHUM> Address" - Returns the address of CHUM token
          * E.g. "CHUM Address"
      `,
      "Address",
      [
        new Arg("chum", getCHUM, { implicit: true })
      ],
      async (world, { chum }) => new AddressV(chum._address)
    ),

    new Fetcher<{ chum: CHUM }, StringV>(`
        #### Name

        * "<CHUM> Name" - Returns the name of the CHUM token
          * E.g. "CHUM Name"
      `,
      "Name",
      [
        new Arg("chum", getCHUM, { implicit: true })
      ],
      async (world, { chum }) => new StringV(await chum.methods.name().call())
    ),

    new Fetcher<{ chum: CHUM }, StringV>(`
        #### Symbol

        * "<CHUM> Symbol" - Returns the symbol of the CHUM token
          * E.g. "CHUM Symbol"
      `,
      "Symbol",
      [
        new Arg("chum", getCHUM, { implicit: true })
      ],
      async (world, { chum }) => new StringV(await chum.methods.symbol().call())
    ),

    new Fetcher<{ chum: CHUM }, NumberV>(`
        #### Decimals

        * "<CHUM> Decimals" - Returns the number of decimals of the CHUM token
          * E.g. "CHUM Decimals"
      `,
      "Decimals",
      [
        new Arg("chum", getCHUM, { implicit: true })
      ],
      async (world, { chum }) => new NumberV(await chum.methods.decimals().call())
    ),

    new Fetcher<{ chum: CHUM }, NumberV>(`
        #### TotalSupply

        * "CHUM TotalSupply" - Returns CHUM token's total supply
      `,
      "TotalSupply",
      [
        new Arg("chum", getCHUM, { implicit: true })
      ],
      async (world, { chum }) => new NumberV(await chum.methods.totalSupply().call())
    ),

    new Fetcher<{ chum: CHUM, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "CHUM TokenBalance <Address>" - Returns the CHUM token balance of a given address
          * E.g. "CHUM TokenBalance Geoff" - Returns Geoff's CHUM balance
      `,
      "TokenBalance",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { chum, address }) => new NumberV(await chum.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ chum: CHUM, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "CHUM Allowance owner:<Address> spender:<Address>" - Returns the CHUM allowance from owner to spender
          * E.g. "CHUM Allowance Geoff Torrey" - Returns the CHUM allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { chum, owner, spender }) => new NumberV(await chum.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ chum: CHUM, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "CHUM GetCurrentVotes account:<Address>" - Returns the current CHUM votes balance for an account
          * E.g. "CHUM GetCurrentVotes Geoff" - Returns the current CHUM vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { chum, account }) => new NumberV(await chum.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ chum: CHUM, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "CHUM GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current CHUM votes balance at given block
          * E.g. "CHUM GetPriorVotes Geoff 5" - Returns the CHUM vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { chum, account, blockNumber }) => new NumberV(await chum.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ chum: CHUM, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "CHUM GetCurrentVotesBlock account:<Address>" - Returns the current CHUM votes checkpoint block for an account
          * E.g. "CHUM GetCurrentVotesBlock Geoff" - Returns the current CHUM votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { chum, account }) => {
        const numCheckpoints = Number(await chum.methods.numCheckpoints(account.val).call());
        const checkpoint = await chum.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ chum: CHUM, account: AddressV }, NumberV>(`
        #### VotesLength

        * "CHUM VotesLength account:<Address>" - Returns the CHUM vote checkpoint array length
          * E.g. "CHUM VotesLength Geoff" - Returns the CHUM vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { chum, account }) => new NumberV(await chum.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ chum: CHUM, account: AddressV }, ListV>(`
        #### AllVotes

        * "CHUM AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "CHUM AllVotes Geoff" - Returns the CHUM vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { chum, account }) => {
        const numCheckpoints = Number(await chum.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await chum.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getCHUMValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("CHUM", chumFetchers(), world, event);
}
