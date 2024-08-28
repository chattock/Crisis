let data = [];
let journals = [];

// Preload the JSONL file
document.addEventListener("DOMContentLoaded", () => {
    fetch('part-1.jsonl')
        .then(response => response.text())
        .then(text => {
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const jsonLine = JSON.parse(line);
                    data.push(jsonLine);
                    if (!journals.includes(jsonLine.isPartOf)) {
                        journals.push(jsonLine.isPartOf);
                    }
                }
            });
            populateJournalSelect();
            generateGraph(); // Automatically generate the graph
        })
        .catch(error => console.error('Error loading JSONL file:', error));
});

document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const lines = e.target.result.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const jsonLine = JSON.parse(line);
                    data.push(jsonLine);
                    if (!journals.includes(jsonLine.isPartOf)) {
                        journals.push(jsonLine.isPartOf);
                    }
                }
            });
            populateJournalSelect();
        };
        reader.readAsText(file);
    }
});

function populateJournalSelect() {
    const journalSelect = document.getElementById('journalSelect');
    journalSelect.innerHTML = ''; // Clear existing options
    journals.forEach(journal => {
        const option = document.createElement('option');
        option.value = journal;
        option.textContent = journal;
        journalSelect.appendChild(option);
    });
}

function getCommonWords() {
    const textAreaValue = document.getElementById('commonWordsText').value;
    return new Set(textAreaValue.split(',').map(word => word.trim()));
}

function generateGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const topWordsCount = parseInt(document.getElementById('topWordsCount').value);
    const neighborsCount = parseInt(document.getElementById('neighborsCount').value);
    const selectedJournal = document.getElementById('journalSelect').value;
    const commonWords = getCommonWords();

    const neighborWeight = parseFloat(document.getElementById('neighborWeight').value);
    const targetProximityStrength = parseFloat(document.getElementById('targetProximityStrength').value);

    const journalData = data.filter(item => item.isPartOf === selectedJournal);
    const fullText = journalData.map(item => item.fullText).join(' ');
    let tokens = fullText.toLowerCase().split(/\W+/);

    // Filter out common words before processing
    tokens = tokens.filter(word => !commonWords.has(word));

    const relatedWords = [];
    const neighborsDict = {};

    tokens.forEach((word, i) => {
        if (word === targetWord) {
            const start = Math.max(i - 5, 0);
            const end = Math.min(i + 6, tokens.length);
            const context = tokens.slice(start, i).concat(tokens.slice(i + 1, end));
            relatedWords.push(...context);

            context.forEach(relatedWord => {
                if (!neighborsDict[relatedWord]) {
                    neighborsDict[relatedWord] = [];
                }
                neighborsDict[relatedWord].push(...context.filter(w => w !== relatedWord));
            });
        }
    });

    const wordFreq = {};
    relatedWords.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topWordsCount);

    const G = new Map();
    G.set(targetWord, wordFreq[targetWord] || 1);

    const edges = [];

    topWords.forEach(([word, freq]) => {
        G.set(word, freq);
        edges.push([targetWord, word]);

        if (neighborsDict[word]) {
            const neighbors = Object.entries(neighborsDict[word].reduce((acc, w) => {
                acc[w] = (acc[w] || 0) + 1;
                return acc;
            }, {}))
            .sort((a, b) => b[1] - a[1])
            .slice(0, neighborsCount);

            neighbors.forEach(([neighbor]) => {
                if (!G.has(neighbor)) {
                    G.set(neighbor, 1);
                }
                if (neighborsDict[neighbor].includes(word)) {
                    edges.push([word, neighbor]);
                }
            });
        }
    });

    const maxFreq = Math.max(...Array.from(G.values()));

    const nodes = [];
    const nodeMap = new Map();

    G.forEach((size, word) => {
        const connectedEdges = edges.filter(edge => edge.includes(word)).length;
        
        // Calculate target proximity only for the target word
        const targetProximity = word === targetWord ? Math.pow(1 - (size / maxFreq), targetProximityStrength / 4) : 1;
        
        // Calculate neighbor proximity inversely to the number of connections
        let neighborProximity = 1;
        if (neighborsDict[word]) {
            neighborProximity = Math.pow(connectedEdges, -neighborWeight * 2);
        }
        
        // Combine proximities
        const combinedProximity = (targetProximity * (1 - neighborWeight)) + (neighborProximity * neighborWeight);
    
        const scale = 10;
        const node = {
            x: (Math.random() - 0.5) * combinedProximity * scale,
            y: (Math.random() - 0.5) * combinedProximity * scale,
            z: (Math.random() - 0.5) * combinedProximity * scale,
            text: `${word}: ${size}`,
            size: 10,
            word: word,
            color: size
        };
        nodes.push(node);
        nodeMap.set(word, node);
    });
    
    // Ensure the target word is positioned at the origin
    const targetNode = nodeMap.get(targetWord);
    if (targetNode) {
        targetNode.x = 0;
        targetNode.y = 0;
        targetNode.z = 0;
    }

    const nodeTrace = {
        x: nodes.map(node => node.x),
        y: nodes.map(node => node.y),
        z: nodes.map(node => node.z),
        text: nodes.map(node => node.text),
        mode: 'markers+text',
        marker: {
            size: 10,
            color: nodes.map(node => node.color),
            colorscale: 'YlGnBu',
            colorbar: {
                title: 'Word Frequency'
            }
        },
        type: 'scatter3d'
    };

    const edgeTrace = {
        x: [],
        y: [],
        z: [],
        mode: 'lines',
        line: {
            width: 0.5,
            color: '#888'
        },
        type: 'scatter3d'
    };

    edges.forEach(([from, to]) => {
        const fromNode = nodeMap.get(from);
        const toNode = nodeMap.get(to);
        if (fromNode && toNode) {
            edgeTrace.x.push(fromNode.x, toNode.x, null);
            edgeTrace.y.push(fromNode.y, toNode.y, null);
            edgeTrace.z.push(fromNode.z, toNode.z, null);
        }
    });

    const layout = {
        title: `3D Network Graph for "${selectedJournal}"`,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { showbackground: false },
            yaxis: { showbackground: false },
            zaxis: { showbackground: false }
        }
    };

    Plotly.newPlot('graph', [edgeTrace, nodeTrace], layout);
}

// Update display values for sliders
document.getElementById('neighborWeight').addEventListener('input', function() {
    document.getElementById('neighborWeightValue').textContent = this.value;
});

document.getElementById('targetProximityStrength').addEventListener('input', function() {
    document.getElementById('targetProximityStrengthValue').textContent = this.value;
});