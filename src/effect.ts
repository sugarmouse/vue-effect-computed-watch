const data = {
    bar: 1,
    foo: 1
};

const proxyData = new Proxy(data, {
    get(target, key, receiver) {
        console.log(`get data[${key.toString()}]`)
        return Reflect.get(target, key, receiver);
    },
    set(target, key, newVal, receiver) {
        const res = Reflect.set(target, key, newVal, receiver);
        console.log(`set data[${key.toString()}] to ${newVal}`)
        return res
    }
});

proxyData.bar++
console.log(proxyData.bar)
console.log(data.bar);
