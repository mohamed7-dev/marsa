import { ConfigService } from '../config/config.service.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';

@Injectable()
export class PersistenceService {
    constructor(private readonly configService: ConfigService) {}

    get persistenceAdapter() {
        return this.configService.persistenceOptions.adapter;
    }
}
