import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { BUMVaultProxy } from '../Contract/BUMVaultProxy';
import { BUMVaultImpl } from '../Contract/BUMVaultImpl';
import { invoke } from '../Invokation';
import { getEventV, getStringV, getAddressV } from '../CoreValue';
import { EventV, StringV, AddressV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { BUMVaultErrorReporter } from '../ErrorReporter';
import { buildBUMVaultProxy } from '../Builder/BUMVaultProxyBuilder';
import { getBUMVaultImpl, getBUMVaultProxy } from '../ContractLookup';
import { verify } from '../Verify';

async function genBUMVaultProxy(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, bumvaultproxy, bumvaultproxyData } = await buildBUMVaultProxy(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMVaultProxy (${bumvaultproxyData.description}) at address ${bumvaultproxy._address}`,
    bumvaultproxyData.invokation
  );

  return world;
}

async function verifyBUMVaultProxy(world: World, bumvaultproxy: BUMVaultProxy, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, 'BUMVaultProxy', 'BUMVaultProxy', bumvaultproxy._address);
  }

  return world;
}

async function acceptAdmin(world: World, from: string, bumvaultproxy: BUMVaultProxy): Promise<World> {
  let invokation = await invoke(world, bumvaultproxy.methods._acceptAdmin(), from, BUMVaultErrorReporter);

  world = addAction(world, `Accept admin as ${from}`, invokation);

  return world;
}

async function setPendingAdmin(
  world: World,
  from: string,
  bumvaultproxy: BUMVaultProxy,
  pendingAdmin: string
): Promise<World> {
  let invokation = await invoke(
    world,
    bumvaultproxy.methods._setPendingAdmin(pendingAdmin),
    from,
    BUMVaultErrorReporter
  );

  world = addAction(world, `Set pending admin to ${pendingAdmin}`, invokation);

  return world;
}

async function setPendingImpl(
  world: World,
  from: string,
  bumvaultproxy: BUMVaultProxy,
  bumvaultImpl: BUMVaultImpl
): Promise<World> {
  let invokation = await invoke(
    world,
    bumvaultproxy.methods._setPendingImplementation(bumvaultImpl._address),
    from,
    BUMVaultErrorReporter
  );

  world = addAction(world, `Set pending bumvault impl to ${bumvaultImpl.name}`, invokation);

  return world;
}

export function bumvaultproxyCommands() {
  return [
    new Command<{ bumvaultproxyParams: EventV }>(
      `
        #### Deploy

        * "BUMVaultProxy Deploy ...bumvaultproxyParams" - Generates a new BUMVaultProxy
          * E.g. "BUMVaultProxy Deploy"
      `,
      'Deploy',
      [new Arg('bumvaultproxyParams', getEventV, { variadic: true })],
      (world, from, { bumvaultproxyParams }) => genBUMVaultProxy(world, from, bumvaultproxyParams.val)
    ),
    new View<{ bumvaultproxy: BUMVaultProxy; apiKey: StringV }>(
      `
        #### Verify

        * "BUMVaultProxy Verify apiKey:<String>" - Verifies BUMVaultProxy in BscScan
          * E.g. "BUMVaultProxy Verify "myApiKey"
      `,
      'Verify',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true }), new Arg('apiKey', getStringV)],
      (world, { bumvaultproxy, apiKey }) => verifyBUMVaultProxy(world, bumvaultproxy, apiKey.val)
    ),
    new Command<{ bumvaultproxy: BUMVaultProxy; pendingAdmin: AddressV }>(
      `
        #### AcceptAdmin

        * "AcceptAdmin" - Accept admin for this bumvaultproxy
          * E.g. "BUMVaultProxy AcceptAdmin"
      `,
      'AcceptAdmin',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true })],
      (world, from, { bumvaultproxy }) => acceptAdmin(world, from, bumvaultproxy)
    ),
    new Command<{ bumvaultproxy: BUMVaultProxy; pendingAdmin: AddressV }>(
      `
        #### SetPendingAdmin

        * "SetPendingAdmin admin:<Admin>" - Sets the pending admin for this bumvaultproxy
          * E.g. "BUMVaultProxy SetPendingAdmin Jared"
      `,
      'SetPendingAdmin',
      [new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true }), new Arg('pendingAdmin', getAddressV)],
      (world, from, { bumvaultproxy, pendingAdmin }) =>
        setPendingAdmin(world, from, bumvaultproxy, pendingAdmin.val)
    ),
    new Command<{ bumvaultproxy: BUMVaultProxy; bumvaultImpl: BUMVaultImpl }>(
      `
        #### SetPendingImpl

        * "SetPendingImpl impl:<Impl>" - Sets the pending bumvault implementation for this bumvaultproxy
          * E.g. "BUMVaultProxy SetPendingImpl MyScenImpl" - Sets the current bumvault implementation to MyScenImpl
      `,
      'SetPendingImpl',
      [
        new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true }),
        new Arg('bumvaultImpl', getBUMVaultImpl)
      ],
      (world, from, { bumvaultproxy, bumvaultImpl }) =>
        setPendingImpl(world, from, bumvaultproxy, bumvaultImpl)
    )
  ];
}

export async function processBUMVaultProxyEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('BUMVaultProxy', bumvaultproxyCommands(), world, event, from);
}
