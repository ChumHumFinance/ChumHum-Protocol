import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { BUMUnitroller } from '../Contract/BUMUnitroller';
import { BUMControllerImpl } from '../Contract/BUMControllerImpl';
import { invoke } from '../Invokation';
import { getEventV, getStringV, getAddressV } from '../CoreValue';
import { EventV, StringV, AddressV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { BUMControllerErrorReporter } from '../ErrorReporter';
import { buildBUMUnitroller } from '../Builder/BUMUnitrollerBuilder';
import { getBUMControllerImpl, getBUMUnitroller } from '../ContractLookup';
import { verify } from '../Verify';

async function genBUMUnitroller(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, bumunitroller, bumunitrollerData } = await buildBUMUnitroller(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMUnitroller (${bumunitrollerData.description}) at address ${bumunitroller._address}`,
    bumunitrollerData.invokation
  );

  return world;
}

async function verifyBUMUnitroller(world: World, bumunitroller: BUMUnitroller, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, 'BUMUnitroller', 'BUMUnitroller', bumunitroller._address);
  }

  return world;
}

async function acceptAdmin(world: World, from: string, bumunitroller: BUMUnitroller): Promise<World> {
  let invokation = await invoke(world, bumunitroller.methods._acceptAdmin(), from, BUMControllerErrorReporter);

  world = addAction(world, `Accept admin as ${from}`, invokation);

  return world;
}

async function setPendingAdmin(
  world: World,
  from: string,
  bumunitroller: BUMUnitroller,
  pendingAdmin: string
): Promise<World> {
  let invokation = await invoke(
    world,
    bumunitroller.methods._setPendingAdmin(pendingAdmin),
    from,
    BUMControllerErrorReporter
  );

  world = addAction(world, `Set pending admin to ${pendingAdmin}`, invokation);

  return world;
}

async function setPendingImpl(
  world: World,
  from: string,
  bumunitroller: BUMUnitroller,
  bumcontrollerImpl: BUMControllerImpl
): Promise<World> {
  let invokation = await invoke(
    world,
    bumunitroller.methods._setPendingImplementation(bumcontrollerImpl._address),
    from,
    BUMControllerErrorReporter
  );

  world = addAction(world, `Set pending bumcontroller impl to ${bumcontrollerImpl.name}`, invokation);

  return world;
}

export function bumunitrollerCommands() {
  return [
    new Command<{ bumunitrollerParams: EventV }>(
      `
        #### Deploy

        * "BUMUnitroller Deploy ...bumunitrollerParams" - Generates a new BUMUnitroller
          * E.g. "BUMUnitroller Deploy"
      `,
      'Deploy',
      [new Arg('bumunitrollerParams', getEventV, { variadic: true })],
      (world, from, { bumunitrollerParams }) => genBUMUnitroller(world, from, bumunitrollerParams.val)
    ),
    new View<{ bumunitroller: BUMUnitroller; apiKey: StringV }>(
      `
        #### Verify

        * "BUMUnitroller Verify apiKey:<String>" - Verifies BUMUnitroller in BscScan
          * E.g. "BUMUnitroller Verify "myApiKey"
      `,
      'Verify',
      [new Arg('bumunitroller', getBUMUnitroller, { implicit: true }), new Arg('apiKey', getStringV)],
      (world, { bumunitroller, apiKey }) => verifyBUMUnitroller(world, bumunitroller, apiKey.val)
    ),
    new Command<{ bumunitroller: BUMUnitroller; pendingAdmin: AddressV }>(
      `
        #### AcceptAdmin

        * "AcceptAdmin" - Accept admin for this bumunitroller
          * E.g. "BUMUnitroller AcceptAdmin"
      `,
      'AcceptAdmin',
      [new Arg('bumunitroller', getBUMUnitroller, { implicit: true })],
      (world, from, { bumunitroller }) => acceptAdmin(world, from, bumunitroller)
    ),
    new Command<{ bumunitroller: BUMUnitroller; pendingAdmin: AddressV }>(
      `
        #### SetPendingAdmin

        * "SetPendingAdmin admin:<Admin>" - Sets the pending admin for this bumunitroller
          * E.g. "BUMUnitroller SetPendingAdmin Jared"
      `,
      'SetPendingAdmin',
      [new Arg('bumunitroller', getBUMUnitroller, { implicit: true }), new Arg('pendingAdmin', getAddressV)],
      (world, from, { bumunitroller, pendingAdmin }) =>
        setPendingAdmin(world, from, bumunitroller, pendingAdmin.val)
    ),
    new Command<{ bumunitroller: BUMUnitroller; bumcontrollerImpl: BUMControllerImpl }>(
      `
        #### SetPendingImpl

        * "SetPendingImpl impl:<Impl>" - Sets the pending bumcontroller implementation for this bumunitroller
          * E.g. "BUMUnitroller SetPendingImpl MyScenImpl" - Sets the current bumcontroller implementation to MyScenImpl
      `,
      'SetPendingImpl',
      [
        new Arg('bumunitroller', getBUMUnitroller, { implicit: true }),
        new Arg('bumcontrollerImpl', getBUMControllerImpl)
      ],
      (world, from, { bumunitroller, bumcontrollerImpl }) =>
        setPendingImpl(world, from, bumunitroller, bumcontrollerImpl)
    )
  ];
}

export async function processBUMUnitrollerEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('BUMUnitroller', bumunitrollerCommands(), world, event, from);
}
