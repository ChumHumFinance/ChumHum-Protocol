import {Event} from '../Event';
import {World} from '../World';
import {BUMVault} from '../Contract/BUMVault';
import {
  getAddressV
} from '../CoreValue';
import {
  AddressV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getBUMVault} from '../ContractLookup';

export async function getBUMVaultAddress(world: World, bumvault: BUMVault): Promise<AddressV> {
  return new AddressV(bumvault._address);
}

export function bumvaultFetchers() {
  return [
    new Fetcher<{bumvault: BUMVault}, AddressV>(`
        #### Address

        * "BUMVault Address" - Returns address of bumcontroller implementation
      `,
      "Address",
      [new Arg("bumvault", getBUMVault)],
      (world, {bumvault}) => getBUMVaultAddress(world, bumvault),
      {namePos: 1}
    )
  ];
}

export async function getBUMVaultValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BUMVault", bumvaultFetchers(), world, event);
}
