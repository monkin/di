# di-sacala

[![Tests](https://github.com/monkin/di-sacala/actions/workflows/test.yml/badge.svg)](https://github.com/monkin/di-sacala/actions/workflows/test.yml)

`di-sacala` is a lightweight, type-safe dependency injection container for TypeScript. It leverages TypeScript's advanced type system to provide a fluent API for service registration and resolution with full type safety and autocompletion.

## Features

- **Full Type Safety**: Get autocompletion and type checks for all your injected services.
- **Fluent API**: Chainable service registration makes it easy to compose your container.
- **Container Composition**: Merge multiple containers together to share dependencies across different parts of your application.
- **Zero Runtime Dependencies**: Extremely lightweight.

## Installation

```bash
npm install di-sacala
```

## Usage

### 1. Defining a Service

A service is a class that implements the `DiService` interface. It must have a `name` property which will be used as the key in the container. Use `as const` to ensure the name is treated as a literal type.

```typescript
import { DiService } from 'di-sacala';

export class LoggerService implements DiService<"logger"> {
    name = "logger" as const;
    
    log(message: string) {
        console.log(`[LOG]: ${message}`);
    }
}
```

### 2. Basic Injection

Use `DiContainer` to register and resolve your services.

```typescript
import { DiContainer } from 'di-sacala';
import { LoggerService } from './LoggerService';

const container = new DiContainer()
    .inject(LoggerService);

// Access the service directly on the container
container.logger.log("Service is ready!");
```

### 3. Services with Dependencies

To inject dependencies into a service, define its constructor to accept the container. You can use the `Di` type helper to specify which services are required.

```typescript
import { Di, DiService } from 'di-sacala';
import { LoggerService } from './LoggerService';

export class UserService implements DiService<"user"> {
    name = "user" as const;
    
    // Use Di<ServiceType> or Di<[Service1, Service2]> for type-safe dependencies
    constructor(private di: Di<LoggerService>) {}

    getUser(id: string) {
        this.di.logger.log(`Fetching user: ${id}`);
        return { id, name: "User " + id };
    }
}

const container = new DiContainer()
    .inject(LoggerService)
    .inject(UserService);

container.user.getUser("42");
```

### 4. Merging Containers

You can create specialized containers and merge them into a main container using `injectContainer`.

```typescript
const authContainer = new DiContainer().inject(AuthService);
const apiContainer = new DiContainer().inject(ApiService);

const appContainer = new DiContainer()
    .injectContainer(authContainer)
    .injectContainer(apiContainer)
    .inject(MainApp);
```

## Development

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch  # Watch mode
```

### Linting & Formatting

```bash
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting
```

## License

ISC

