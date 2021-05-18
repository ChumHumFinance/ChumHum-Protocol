import {Event} from '../Event';
import {World} from '../World';
import {BUMVaultImpl} from '../Contract/BUMVaultImpl';
import {
  getAddressV
} from '../CoreValue';
import {
  AddressV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getBUMVaultImpl} from '../ContractLookup';

export async function getBUMVaultImplAddress(world: World, bumvaultImpl: BUMVaultImpl): Promise<AddressV> {
  return new AddressV(bumvaultImpl._address);
}

export function bumvaultImplFetchers() {
  return [
    new Fetcher<{bumvaultImpl: BUMVaultImpl}, AddressV>(`
        #### Address

        * "BUMVaultImpl Address" - Returns address of bumvault implementation
      `,
      "Address",
      [new Arg("bumvaultImpl", getBUMVaultImpl)],
      (world, {bumvaultImpl}) => getBUMVaultImplAddress(world, bumvaultImpl),
      {namePos: 1}
    )
  ];
}

export async function getBUMVaultImplValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BUMVaultImpl", bumvaultImplFetchers(), world, event);
}
