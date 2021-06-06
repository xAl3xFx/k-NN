// const fs = require('fs');

const readTextFileFS = (file) => {
    let data = fs.readFileSync(file,  {encoding:'utf8', flag:'r'});
    data = data.split('\r\n');
    return data.slice(1, data.length - 1);
};
const readTextFile = async (file) => {
    return new Promise((resolve, reject) =>{
        var rawFile = new XMLHttpRequest();
        rawFile.open("GET", file, false);
        rawFile.onreadystatechange = function ()
        {
            if(rawFile.readyState === 4)
            {
                if(rawFile.status === 200 || rawFile.status == 0)
                {
                    var data = rawFile.responseText;
                    data = data.split('\r\n');
                    data = data.slice(1, data.length - 1);
                    resolve(data);
                }
            }
        }
        rawFile.send(null);
    })
};


const parseClients = (data) => {
    const clients = [];

    for(let row of data){
        const tokens = row.split(';');
        const client = {
            amount: tokens[0] - 0,
            frequency: tokens[1].trim(),
            isPromo: tokens[2] - 0
        }
        clients.push(client);
    }

    return clients
};

const convertFrequenciesToNumbers = (clients) => {
    const amounts = clients.map(el => el.amount);
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    const step = (max - min) / 3;
    const map = {
        "Rarely" : min,
        "Sometimes" : min + step,
        "Often" : min + 2 * step,
        "Very often" : max
    };

    return map;
};

const euclideanDistance = (frequencyMap, client1, client2) => {
    const distance = Math.sqrt((Math.pow((client1.amount - client2.amount),2) + Math.pow((frequencyMap[client1.frequency] - frequencyMap[client2.frequency]),2)));
    return distance;
};


const comparator = (frequencyMap, distanceFunction, query) => {
    return (client1, client2) => {
        const distanceFromClient1ToQuery = distanceFunction(frequencyMap, client1, query);
        const distanceFromClient2ToQuery = distanceFunction(frequencyMap, client2, query);

        if (distanceFromClient1ToQuery < distanceFromClient2ToQuery)
            return -1;

        if (distanceFromClient1ToQuery > distanceFromClient2ToQuery)
            return 1;

        return 0;
    }
};

const mode = (clients) => {
    let zeros = 0, ones = 1;
    for(let client of clients)
        client.isPromo ? ones++ : zeros++

    return ones > zeros;
};

// const knn = (clients, frequencyMap, K) => {
//     //First we need to sort all clients
//     const sortedClients = clients.slice(0,30).sort(comparator(frequencyMap, euclideanDistance, query));
//     const firstKNearestNeighbours = sortedClients.slice(0, K);
//     return mode(firstKNearestNeighbours);
//
// };

const getNRandomClients = (clients, N) => {
    const randomClients = [];
    for(let i=0; i < N; i++){
        const randomIndex = Math.floor(Math.random() * clients.length);
        randomClients.push(clients[randomIndex]);
        clients.splice(randomIndex, 1);
    }
    return { randomClients, restClients : clients };

};

const knn = (clients, frequencyMap, K) => {
    let { randomClients : clientsForTest, restClients : clientsForTraining } = clients;
    let totalHits = 0;
    for(let client of clientsForTest){
        const sortedClients = clientsForTraining.sort(comparator(frequencyMap, euclideanDistance, client));
        const firstKNearestNeighbours = sortedClients.slice(0, K);
        const result = mode(firstKNearestNeighbours);
        const actualResult = client.isPromo;
        if(actualResult == result)
            totalHits++;
    }
    return totalHits
};

const classify = async () => {
    const amount = document.getElementById("test-entry-amount").value;
    const frequency = document.getElementById("test-entry-frequency").value;
    const K = document.getElementById("test-entry-kParam").value;

    console.log("Amount: ", amount);
    console.log("frequency: ", frequency);
    console.log("K: ", K);

    if(!amount || amount === "" || !frequency || !K || K === ""){
        document.getElementById("test-entry-label").innerText = 'Invalid params';
        document.getElementById("test-entry-label").style = "";
        return
    }


    const file = await readTextFile('./dataset.csv');
    const clients = parseClients(file);
    const frequencyMap = convertFrequenciesToNumbers(clients);

    const query = {
        amount: amount,
        frequency: frequency
    };

    const sortedClients = clients.sort(comparator(frequencyMap, euclideanDistance, query));
    const firstKNearestNeighbours = sortedClients.slice(0, K);
    console.log(firstKNearestNeighbours)
    const result = mode(firstKNearestNeighbours);
    console.log(result)

    document.getElementById("test-entry-label").innerText = `Отговор: ${result ? "Да" : "Не"    }`;
    document.getElementById("test-entry-label").style = "";


};

const start = async () => {
    const file = await readTextFile('./dataset.csv');
    const clients = parseClients(file);
    const frequencyMap = convertFrequenciesToNumbers(clients);
    let splitedClients = getNRandomClients(clients, 10);

    const resultsTable = {};
    for(let k=1; k <= 40; k++){
        let totalHits = 0;
        for(let i=0; i < 1000; i++){
            totalHits += knn(splitedClients, frequencyMap, k);
        }
        resultsTable[k] = totalHits/1000;
    }

    generateTableForTestedClients(splitedClients);
    generateTableForK(resultsTable);

    console.log(resultsTable, splitedClients)

    // console.log("Random Clients: " + result)
};

const generateTableForK = (resultsTable) => {
    const tBody = document.getElementById("kTable-table-body");
    tBody.innerHTML = "";
    Object.keys(resultsTable).forEach(el => {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        td1.innerText = el;
        td2.innerText = resultsTable[el] * 10 + " %";

        tr.appendChild(td1);
        tr.appendChild(td2);

        tBody.appendChild(tr);
    });
}

const generateTableForTestedClients = (splitedClients) => {
    let { randomClients : clientsForTest, restClients : clientsForTraining } = splitedClients;

    const tBody = document.getElementById("testing-table-body");
    tBody.innerHTML = "";

    for(let client of clientsForTest){
        const tr = document.createElement("tr");
        tr.style = "background: green";

        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        const td3 = document.createElement("td");
        td1.innerText = client.amount;
        td2.innerText = client.frequency;
        td3.innerText = client.isPromo ? "Да" : "Не";

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);

        tBody.appendChild(tr);
    }

    for(let client of clientsForTraining){
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        const td3 = document.createElement("td");
        td1.innerText = client.amount;
        td2.innerText = client.frequency;
        td3.innerText = client.isPromo ? "Да" : "Не";

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);

        tBody.appendChild(tr);
    }

    document.getElementById("testing").style.display = "block";
}

const loadTable = async () => {
    const file = await readTextFile('./dataset.csv');
    const clients = parseClients(file);
    const tBody = document.getElementById("dataset-table-body");

    for(let client of clients){
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        const td3 = document.createElement("td");
        td1.innerText = client.amount;
        td2.innerText = client.frequency;
        td3.innerText = client.isPromo ? "Да" : "Не";

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);

        tBody.appendChild(tr);
    }

}

// start();
