import { Event } from '../Event';
import { World } from '../World';
import { BUMVaultProxy } from '../Contract/BUMVaultProxy';
import { AddressV, Value } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getBUMVaultProxy } from '../ContractLookup';

export async function getBUMVaultProxyAddress(world: World, bumvaultproxy: BUMVaultProxy): Promise<AddressV> {
  return new AddressV(bumvaultproxy._address);
}

async function getBUMVaultProxyAdmin(world: World, bumvaultproxy: BUMVaultProxy): Promise<AddressV> {
  return new AddressV(await bumvaultproxy.methods.admin().call());
}

async function getBUMVaultProxyPendingAdmin(world: World, bumvaultproxy: BUMVaultProxy): Promise<AddressV> {
  return new AddressV(await bumvaultproxy.methods.pendingAdmin().call());
}

async function getBUMVaultImplementation(world: World, bumvaultproxy: BUMVaultProxy): Promise<AddressV> {
  return new AddressV(await bumvaultproxy.methods.bumvaultImplementation().call());
}

async function getPendingBUMVaultImplementation(world: World, bumvaultproxy: BUMVaultProxy): Promise<AddressV> {
  return new AddressV(await bumvaultproxy.methods.pendingBUMVaultImplementation().call());
}

export function bumvaultproxyFetchers() {
  return [
    new Fetcher<{ bumvaultproxy: BUMVaultProxy }, AddressV>(
      `
        #### Address

        * "BUMVaultProxy Address" - Returns address of bumvaultproxy
      `,
      'Address',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, { bumvaultproxy }) => getBUMVaultProxyAddress(world, bumvaultproxy)
    ),
    new Fetcher<{ bumvaultproxy: BUMVaultProxy }, AddressV>(
      `
        #### Admin

        * "BUMVaultProxy Admin" - Returns the admin of BUMVaultProxy contract
          * E.g. "BUMVaultProxy Admin" - Returns address of admin
      `,
      'Admin',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, { bumvaultproxy }) => getBUMVaultProxyAdmin(world, bumvaultproxy)
    ),
    new Fetcher<{ bumvaultproxy: BUMVaultProxy }, AddressV>(
      `
        #### PendingAdmin

        * "BUMVaultProxy PendingAdmin" - Returns the pending admin of BUMVaultProxy contract
          * E.g. "BUMVaultProxy PendingAdmin" - Returns address of pendingAdmin
      `,
      'PendingAdmin',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, { bumvaultproxy }) => getBUMVaultProxyPendingAdmin(world, bumvaultproxy)
    ),
    new Fetcher<{ bumvaultproxy: BUMVaultProxy }, AddressV>(
      `
        #### Implementation

        * "BUMVaultProxy Implementation" - Returns the Implementation of BUMVaultProxy contract
          * E.g. "BUMVaultProxy Implementation" - Returns address of comptrollerImplentation
      `,
      'Implementation',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, { bumvaultproxy }) => getBUMVaultImplementation(world, bumvaultproxy)
    ),
    new Fetcher<{ bumvaultproxy: BUMVaultProxy }, AddressV>(
      `
        #### PendingImplementation

        * "BUMVaultProxy PendingImplementation" - Returns the pending implementation of BUMVaultProxy contract
          * E.g. "BUMVaultProxy PendingImplementation" - Returns address of pendingComptrollerImplementation
      `,
      'PendingImplementation',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, { bumvaultproxy }) => getPendingBUMVaultImplementation(world, bumvaultproxy)
    )
  ];
}

export async function getBUMVaultProxyValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>('BUMVaultProxy', bumvaultproxyFetchers(), world, event);
}
