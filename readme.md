# Helium

Work in progress. Do not use in production. Many features still missing

## What is Helium?

Helium is a schema modeling language similar to protocolbuffers that compiles into clients and server libraries for different platforms to achieve validated, efficient and type safe serialization, deserialization and transportation of data over different protocols

Basically it's like a common interface language for solid data transfer between applications of varying platforms

## How does helium work?

Helium works in a project basis like C# or Typescript. You create a project with a heconfig.json file and include helium source code (.he files). You set compile options in heconfig.json and then run the helium compiler (hec) to produce libraries ready to be consumed by the defined output platforms

## Supported compile targets

-   Javascript (browser and nodejs. Also emits matching typescript typings)

## Future platforms

-   JVM compile helium to jars usable by JVM based languages such as Java
-   CIL compile helium to DLLs usable by CIL based languages such as C#

## What do those libraries do?

The compiled output is a library that contains classes for each message and service defined in helium. Helium can compile to 2 types of libraries client and server.
Messages constants and enums will be the same for both client and server but services will be different
The client libraries contain service code for sending messages to the server and the server libraries contain code for handling incoming messages for those services. The actual implementation of the handling is done in the application that consumes the libraries.

## Example

```ts

export message EmailChange {
    @match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)
    1 -> newEmail:string;
}

export message Unauthorized {
    1 -> message:string;
}

export message EmailAlreadyUsed {
    1 -> message:string;
}

export service User {
	http changeEmail(EmailChange):void throws Unauthorized | EmailAlreadyUsed;
}
```

The above code would generate a library with a factory class for each message and for client it would generate a class for User with the static function changeEmail that would send over http(s) to the server and the server library would have a user class with a static method for serializing the input and output (which ensures that the validation passes and the data is correctly formed)

With helium you can be sure that the data that is sent has the correct shape as defined by your helium schema and that the data that arrives is rejected if it does not match the same schema.

This basically eliminates manually verifying data integrity and ensures you can type safely serialize and deserialize.

## Syntax

The syntax is as close to typescript as possible while incorporating things that are required for a schema language. A more complete guide will be added at a later date

## Feature advantages compared to protocol buffers

-   First party validation support
-   Allows modeling errors that services may return
-   Can define constants. Both globally and as static properties of services
-   Explicitly define which messages/services are exposed
-   String and Number enums
-   Message inheritence support
-   Type Unions
-   Type Aliasing support
-   Default values even for arrays and sub messages
-   Arrays can be optional
-   Support for Date type fields (64 bit timestamps only)
-   Support for Sets (Unsorted arrays of unique values)
-   Managed as projects which helps structure code and ability to make reusable helium code that can be imported in other projects
-   Friendlier Typescript like syntax (subjective)

## Not yet Implemented

-   Type unions
-   Generation of validation code
-   Server side runtime library for Nodejs
-   JVM compile target
-   CIL compile target
-   Sharing helium code by importing it in one helium project from another helium project
-   Compiler errors not user friendly
-   Setting of default Values
-   Sub message default Values
-   Generic types
