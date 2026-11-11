import type { ZodType } from 'zod';
import { MarsaError, type MarsaErrorCode } from '../../common/errors/errors.js';
import { Injectable } from '../../infra/ioc-container/injectable.decorator.js';

@Injectable()
export class Validator {
    assertValidInput<Schema extends ZodType>(
        schema: Schema,
        input: unknown,
        code: MarsaErrorCode,
        label: string,
    ): void {
        const result = schema.safeParse(input);
        if (!result.success) {
            const details = result.error.issues
                .map(issue => {
                    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
                    return `${path}: ${issue.message}`;
                })
                .join('; ');
            throw new MarsaError(code, `${label} is invalid: ${details}`, { cause: result.error });
        }
    }
}
