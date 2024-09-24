import { instantiate } from "./lib/rs_lib.generated.js";

const { add, Greeter } = await instantiate();

// adds
console.log(add(1, 1));

// greets
const greeter = new Greeter("world");
console.log(greeter.greet());
