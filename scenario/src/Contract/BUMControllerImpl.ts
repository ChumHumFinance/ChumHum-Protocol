import { Contract } from '../Contract';
import { Sendable } from '../Invokation';

interface BUMControllerImplMethods {
  _become(
    controller: string
  ): Sendable<string>;
}

export interface BUMControllerImpl extends Contract {
  methods: BUMControllerImplMethods;
}
