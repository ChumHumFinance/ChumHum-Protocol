import { Contract } from '../Contract';
import { Sendable } from '../Invokation';

interface BUMVaultImplMethods {
  _become(
    controller: string
  ): Sendable<string>;
}

export interface BUMVaultImpl extends Contract {
  methods: BUMVaultImplMethods;
}
