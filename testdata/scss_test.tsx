import "./css/styles.scss";

function createElement(fn: () => string) {
    return fn();
}

const React = { createElement };

function Scss() {
    return "foo";
}

export default <Scss />;
