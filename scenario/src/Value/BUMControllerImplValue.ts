import {Event} from '../Event';
import {World} from '../World';
import {BUMControllerImpl} from '../Contract/BUMControllerImpl';
import {
  getAddressV
} from '../CoreValue';
import {
  AddressV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getBUMControllerImpl} from '../ContractLookup';

export async function getBUMControllerImplAddress(world: World, bumcontrollerImpl: BUMControllerImpl): Promise<AddressV> {
  return new AddressV(bumcontrollerImpl._address);
}

export function bumcontrollerImplFetchers() {
  return [
    new Fetcher<{bumcontrollerImpl: BUMControllerImpl}, AddressV>(`
        #### Address

        * "BUMControllerImpl Address" - Returns address of bumcontroller implementation
      `,
      "Address",
      [new Arg("bumcontrollerImpl", getBUMControllerImpl)],
      (world, {bumcontrollerImpl}) => getBUMControllerImplAddress(world, bumcontrollerImpl),
      {namePos: 1}
    )
  ];
}

export async function getBUMControllerImplValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BUMControllerImpl", bumcontrollerImplFetchers(), world, event);
}
