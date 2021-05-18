import { Event } from '../Event';
import { World } from '../World';
import { BUM } from '../Contract/BUM';
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
import { getBUM } from '../ContractLookup';

export function bumFetchers() {
  return [
    new Fetcher<{ bum: BUM }, AddressV>(`
        #### Address

        * "<BUM> Address" - Returns the address of BUM token
          * E.g. "BUM Address"
      `,
      "Address",
      [
        new Arg("bum", getBUM, { implicit: true })
      ],
      async (world, { bum }) => new AddressV(bum._address)
    ),

    new Fetcher<{ bum: BUM }, StringV>(`
        #### Name

        * "<BUM> Name" - Returns the name of the BUM token
          * E.g. "BUM Name"
      `,
      "Name",
      [
        new Arg("bum", getBUM, { implicit: true })
      ],
      async (world, { bum }) => new StringV(await bum.methods.name().call())
    ),

    new Fetcher<{ bum: BUM }, StringV>(`
        #### Symbol

        * "<BUM> Symbol" - Returns the symbol of the BUM token
          * E.g. "BUM Symbol"
      `,
      "Symbol",
      [
        new Arg("bum", getBUM, { implicit: true })
      ],
      async (world, { bum }) => new StringV(await bum.methods.symbol().call())
    ),

    new Fetcher<{ bum: BUM }, NumberV>(`
        #### Decimals

        * "<BUM> Decimals" - Returns the number of decimals of the BUM token
          * E.g. "BUM Decimals"
      `,
      "Decimals",
      [
        new Arg("bum", getBUM, { implicit: true })
      ],
      async (world, { bum }) => new NumberV(await bum.methods.decimals().call())
    ),

    new Fetcher<{ bum: BUM }, NumberV>(`
        #### TotalSupply

        * "BUM TotalSupply" - Returns BUM token's total supply
      `,
      "TotalSupply",
      [
        new Arg("bum", getBUM, { implicit: true })
      ],
      async (world, { bum }) => new NumberV(await bum.methods.totalSupply().call())
    ),

    new Fetcher<{ bum: BUM, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "BUM TokenBalance <Address>" - Returns the BUM token balance of a given address
          * E.g. "BUM TokenBalance Geoff" - Returns Geoff's BUM balance
      `,
      "TokenBalance",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { bum, address }) => new NumberV(await bum.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ bum: BUM, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "BUM Allowance owner:<Address> spender:<Address>" - Returns the BUM allowance from owner to spender
          * E.g. "BUM Allowance Geoff Torrey" - Returns the BUM allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { bum, owner, spender }) => new NumberV(await bum.methods.allowance(owner.val, spender.val).call())
    )
  ];
}

export async function getBUMValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BUM", bumFetchers(), world, event);
}
