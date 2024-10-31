let network;
let nodes = new vis.DataSet();
let edges = new vis.DataSet();
let networkData = {
    nodes: nodes,
    edges: edges
};

const layouts = {
    standard: {
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -26,
                centralGravity: 0.005,
                springLength: 230,
                springConstant: 0.18
            }
        }
    }
};

function initNetwork() {
    let container = document.getElementById('network');
    let options = {
        ...layouts.standard,
        nodes: {
            shape: 'circle',
            size: 25,
            font: {
                size: 14,
                color: '#ffffff'
            },
            color: {
                background: '#4CAF50',
                border: '#45a049',
                highlight: {
                    background: '#45a049',
                    border: '#397d3b'
                }
            }
        },
        edges: {
            font: {
                size: 12,
                align: 'middle'
            },
            width: 2,
            color: {
                color: '#848484',
                highlight: '#2196F3'
            },
            arrows: {
                to: {
                    enabled: false
                }
            }
        }
    };
    network = new vis.Network(container, networkData, options);

    network.on('stabilized', function () {
        console.log('Network has been stabilized');
    });
}

function updateLayout() {
    const layoutStyle = document.getElementById('layoutStyle').value;
    network.setOptions(layouts[layoutStyle]);
}

function resetLayout() {
    network.setOptions(layouts.standard);
    network.stabilize();
}

function clearNetwork() {
    if (confirm('Are you sure you want to clear the entire network?')) {
        nodes.clear();
        edges.clear();
        updateSelects();
    }
}

function addRouter() {
    let name = document.getElementById('routerName').value;
    if (name && !nodes.get(name)) {
        nodes.add({
            id: name,
            label: name,
            title: `Router ${name}`
        });
        updateSelects();
        document.getElementById('routerName').value = '';
    }
}

function removeRouter() {
    let routerName = document.getElementById('removeRouter').value;
    if (routerName) {
        nodes.remove(routerName);
        edges.get().forEach(edge => {
            if (edge.from === routerName || edge.to === routerName) {
                edges.remove(edge.id);
            }
        });
        updateSelects();
    }
}

function addLink() {
    let source = document.getElementById('source').value;
    let target = document.getElementById('target').value;
    let cost = parseInt(document.getElementById('cost').value);

    if (source && target && cost && source !== target) {
        let edgeId = `${source}-${target}`;
        let reverseEdgeId = `${target}-${source}`;

        if (!edges.get(edgeId) && !edges.get(reverseEdgeId)) {
            edges.add({
                id: edgeId,
                from: source,
                to: target,
                label: cost.toString(),
                cost: cost,
                title: `Cost: ${cost}`
            });
            updateSelects();
            document.getElementById('cost').value = '';
        }
    }
}

function removeLink() {
    let linkId = document.getElementById('removeLink').value;
    if (linkId) {
        edges.remove(linkId);
        updateSelects();
    }
}

function updateSelects() {
    let routersList = nodes.get().map(node => node.id);
    let linksList = edges.get().map(edge => ({
        id: edge.id,
        text: `${edge.from} ↔ ${edge.to} (${edge.label})`
    }));

    ['source', 'target', 'sourceRouter', 'removeRouter'].forEach(selectId => {
        let select = document.getElementById(selectId);
        select.innerHTML = '';
        routersList.forEach(router => {
            let option = document.createElement('option');
            option.value = router;
            option.text = router;
            select.appendChild(option);
        });
    });

    let linkSelect = document.getElementById('removeLink');
    linkSelect.innerHTML = '';
    linksList.forEach(link => {
        let option = document.createElement('option');
        option.value = link.id;
        option.text = link.text;
        linkSelect.appendChild(option);
    });
}
function animatePacketOnCanvas(sourceId, targetId, isReply) {
    const positions = network.getPositions([sourceId, targetId]);
    const sourcePos = positions[sourceId];
    const targetPos = positions[targetId];

    // Generate unique ID for the packet
    const packetId = `packet-${sourceId}-${targetId}-${Date.now()}`;

    // Set different colors and sizes for hello and reply packets
    const packetColor = isReply ? '#00FF00' : '#FF0000';  // Green for reply, Red for hello
    const packetSize = isReply ? 6 : 8;  // Slightly smaller size for reply packets

    // Create a temporary node for the packet
    nodes.add({
        id: packetId,
        label: '',
        size: packetSize,
        shape: 'dot',  // Using dot shape for better visibility
        color: {
            background: packetColor,
            border: packetColor,
            highlight: {
                background: packetColor,
                border: packetColor
            }
        },
        x: sourcePos.x,
        y: sourcePos.y,
        physics: false,
        font: { size: 0 }  // Hide any potential label
    });

    // Animation parameters
    const duration = 1500;
    const frames = 60;
    const delay = duration / frames;
    let frame = 0;

    // Animation function
    function animate() {
        if (frame <= frames) {
            const progress = frame / frames;
            const x = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
            const y = sourcePos.y + (targetPos.y - sourcePos.y) * progress;

            nodes.update({
                id: packetId,
                x: x,
                y: y,
                color: {  // Reinforce color during animation
                    background: packetColor,
                    border: packetColor,
                    highlight: {
                        background: packetColor,
                        border: packetColor
                    }
                }
            });

            frame++;
            setTimeout(animate, delay);
        } else {
            // Remove the packet node when animation is complete
            nodes.remove(packetId);
        }
    }

    // Start animation
    animate();
}

function displayResults(data) {
    let resultsHtml = '<h3>Shortest Paths from Source:</h3>';
    for (let target in data.paths) {
        const pathInfo = data.paths[target];
        if (pathInfo.path.length > 0) {
            resultsHtml += `
                        <div class="step-card">
                            <h4>Path to ${target}</h4>
                            <div class="step-detail">Route: ${pathInfo.path.join(' → ')}</div>
                            <div class="step-detail">Total Cost: ${pathInfo.cost}</div>
                            <div class="step-detail">Number of Hops: ${pathInfo.hops}</div>
                        </div>`;
        }
    }
    document.getElementById('pathResults').innerHTML = resultsHtml;

    let stepsHtml = '';
    data.history.forEach((step, index) => {
        stepsHtml += `
                    <div class="step-card">
                        <h4>Step ${index + 1}: Processing Router ${step.current}</h4>
                        <div class="step-detail">Current Distances:</div>
                        <div class="step-detail">
                            ${Object.entries(step.distances)
                .map(([router, dist]) => `${router}: ${dist}`)
                .join(', ')}
                        </div>
                        <div class="step-detail">Visited Nodes: ${step.visited.join(', ')}</div>
                        ${Object.keys(step.neighbors).length > 0 ? `
                            <div class="step-detail">Evaluating Neighbors:</div>
                            ${Object.entries(step.neighbors)
                    .map(([neighbor, info]) => `
                                    <div class="step-detail">
                                        → ${neighbor}: Cost=${info.cost}, 
                                        New Distance=${info.total_distance}, 
                                        Current Best=${info.current_best}
                                    </div>`)
                    .join('')}
                        ` : ''}
                    </div>`;
    });
    document.getElementById('stepHistory').innerHTML = stepsHtml;

    highlightPaths(data.paths);
}

function highlightPaths(paths) {
    edges.get().forEach(edge => {
        edges.update({
            id: edge.id,
            color: { color: '#848484' },
            width: 2
        });
    });

    nodes.get().forEach(node => {
        nodes.update({
            id: node.id,
            color: {
                background: '#4CAF50',
                border: '#45a049'
            }
        });
    });

    const colors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00'];
    let colorIndex = 0;

    for (let target in paths) {
        const path = paths[target].path;
        const pathColor = colors[colorIndex % colors.length];

        path.forEach(router => {
            nodes.update({
                id: router,
                color: {
                    background: pathColor,
                    border: pathColor
                }
            });
        });

        for (let i = 0; i < path.length - 1; i++) {
            const edgeId = `${path[i]}-${path[i + 1]}`;
            const reverseEdgeId = `${path[i + 1]}-${path[i]}`;
            const actualEdgeId = edges.get(edgeId) ? edgeId : reverseEdgeId;

            edges.update({
                id: actualEdgeId,
                color: { color: pathColor },
                width: 4
            });
        }

        colorIndex++;
    }
}

function calculatePaths() {
    let source = document.getElementById('sourceRouter').value;
    if (!source) {
        alert('Please select a source router');
        return;
    }

    if (nodes.get().length === 0) {
        alert('Please add some routers to the network');
        return;
    }

    if (edges.get().length === 0) {
        alert('Please add some links between routers');
        return;
    }

    let networkData = {
        routers: nodes.get().map(node => node.id),
        links: edges.get().map(edge => ({
            source: edge.from,
            target: edge.to,
            cost: parseInt(edge.label)
        })),
        source: source
    };

    fetch('/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(networkData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);  // Debug log
            displayResults(data);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while calculating paths: ' + error.message);
        });
}

// New functions for Link State Routing visualization
function startNeighborDiscovery() {
    fetch('/start_discovery', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            routers: nodes.get().map(node => node.id),
            links: edges.get().map(edge => ({
                source: edge.from,
                target: edge.to,
                cost: parseInt(edge.label)
            }))
        })
    })
        .then(response => response.json())
        .then(data => {
            displayNeighborDiscoverySteps(data.steps);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred during neighbor discovery: ' + error.message);
        });
}

function startLSPFlooding() {
    fetch('/start_flooding', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            routers: nodes.get().map(node => node.id),
            links: edges.get().map(edge => ({
                source: edge.from,
                target: edge.to,
                cost: parseInt(edge.label)
            }))
        })
    })
        .then(response => response.json())
        .then(data => {
            displayLSPFloodingSteps(data.steps);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred during LSP flooding: ' + error.message);
        });
}

function buildRoutingTables() {
    fetch('/build_routing_tables', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            routers: nodes.get().map(node => node.id),
            links: edges.get().map(edge => ({
                source: edge.from,
                target: edge.to,
                cost: parseInt(edge.label)
            }))
        })
    })
        .then(response => response.json())
        .then(data => {
            displayRoutingTables(data.routing_tables);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while building routing tables: ' + error.message);
        });
}

function displayNeighborDiscoverySteps(steps) {
    let stepsHtml = '<h3>Neighbor Discovery Steps:</h3>';
    steps.forEach((step, index) => {
        stepsHtml += `
                    <div class="step-card">
                        <h4>Step ${index + 1}: Router ${step.router}</h4>
                        <div class="step-detail">Discovered Neighbors: ${step.discovered_neighbors.join(', ')}</div>
                        <div class="step-detail">Link Costs: ${Object.entries(step.costs).map(([neighbor, cost]) => `${neighbor}: ${cost}`).join(', ')}</div>
                    </div>`;
        // Animate both hello packets and reply packets with delays
        step.discovered_neighbors.forEach((neighbor, neighborIndex) => {
            // Hello packet animation (outgoing) - Red color
            setTimeout(() => {
                animatePacketOnCanvas(step.router, neighbor, false);  // Hello packet
            }, (index * 3000) + (neighborIndex * 2300));

            // Reply packet animation (incoming) - Green color
            setTimeout(() => {
                animatePacketOnCanvas(neighbor, step.router, true);  // Reply packet
            }, (index * 3000) + (neighborIndex * 2000) + 2000);
        });
    });
    document.getElementById('stepHistory').innerHTML = stepsHtml;
}

function displayLSPFloodingSteps(steps) {
    let stepsHtml = '<h3>LSP Flooding Steps:</h3>';
    steps.forEach((step, index) => {
        stepsHtml += `
                    <div class="step-card">
                        <h4>Step ${index + 1}: LSP from Router ${step.source_router}</h4>
                        <div class="step-detail">LSP Content: ${JSON.stringify(step.lsp)}</div>
                        <div class="step-detail">Reached Routers: ${step.reached_routers.join(', ')}</div>
                    </div>`;

        // Animate LSP flooding from source router
        animateFloodingStep(step, index);
    });
    document.getElementById('stepHistory').innerHTML = stepsHtml;
}

function animateFloodingStep(step, stepIndex) {
    const baseDelay = stepIndex * 5000; // Base delay between different LSP sources
    const propagationDelay = 1000; // Delay between hops
    let visitedPairs = new Set(); // Track which links we've animated

    // Function to animate LSP propagation recursively
    function propagateLSP(currentRouter, seenRouters = new Set(), level = 0) {
        const neighbors = getRouterNeighbors(currentRouter);
        seenRouters.add(currentRouter);

        neighbors.forEach(neighbor => {
            // Create unique identifier for this link in both directions
            const linkId1 = `${currentRouter}-${neighbor}`;
            const linkId2 = `${neighbor}-${currentRouter}`;

            // Check if we haven't animated this link yet and neighbor hasn't been source
            if (!visitedPairs.has(linkId1) && !visitedPairs.has(linkId2) &&
                !seenRouters.has(neighbor)) {

                visitedPairs.add(linkId1);
                visitedPairs.add(linkId2);

                // Calculate delay based on propagation level
                const delay = baseDelay + (level * propagationDelay);

                // Animate LSP packet
                setTimeout(() => {
                    animateLSPPacket(currentRouter, neighbor, () => {
                        // After packet reaches neighbor, continue flooding from there
                        propagateLSP(neighbor, seenRouters, level + 1);
                    });
                }, delay);
            }
        });
    }

    // Start flooding from source router
    propagateLSP(step.source_router);
}

function animateLSPPacket(sourceId, targetId, onComplete) {
    const positions = network.getPositions([sourceId, targetId]);
    const sourcePos = positions[sourceId];
    const targetPos = positions[targetId];

    // Generate unique ID for the LSP packet
    const packetId = `lsp-${sourceId}-${targetId}-${Date.now()}`;

    // Create a temporary node for the LSP packet
    nodes.add({
        id: packetId,
        label: 'LSP',
        size: 10,
        shape: 'diamond',
        color: {
            background: '#FFA500', // Orange color for LSP packets
            border: '#FF8C00',
            highlight: {
                background: '#FFA500',
                border: '#FF8C00'
            }
        },
        x: sourcePos.x,
        y: sourcePos.y,
        physics: false,
        font: {
            size: 8,
            color: '#000000',
            face: 'arial'
        }
    });

    // Animation parameters
    const duration = 800; // Slightly faster than hello/reply packets
    const frames = 60;
    const delay = duration / frames;
    let frame = 0;

    // Animation function
    function animate() {
        if (frame <= frames) {
            const progress = frame / frames;
            const x = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
            const y = sourcePos.y + (targetPos.y - sourcePos.y) * progress;

            nodes.update({
                id: packetId,
                x: x,
                y: y
            });

            frame++;
            setTimeout(animate, delay);
        } else {
            // Remove the packet node when animation is complete
            nodes.remove(packetId);

            // Call the completion callback if provided
            if (onComplete) {
                setTimeout(onComplete, 100);
            }
        }
    }

    // Start animation
    animate();
}

function getRouterNeighbors(routerId) {
    // Get all neighbors of a router from the network edges
    const neighbors = new Set();
    edges.get().forEach(edge => {
        if (edge.from === routerId) {
            neighbors.add(edge.to);
        } else if (edge.to === routerId) {
            neighbors.add(edge.from);
        }
    });
    return Array.from(neighbors);
}

// Helper function to highlight active routers during flooding
function highlightRouter(routerId, isActive) {
    nodes.update({
        id: routerId,
        color: {
            background: isActive ? '#FFA500' : '#4CAF50', // Orange when active, back to green when done
            border: isActive ? '#FF8C00' : '#45a049'
        }
    });
}

function displayRoutingTables(routingTables) {
    let tablesHtml = '<h3>Routing Tables:</h3>';
    for (let router in routingTables) {
        tablesHtml += `
                    <div class="step-card">
                        <h4>Routing Table for ${router}</h4>
                        <table class="routing-table">
                            <tr><th>Destination</th><th>Next Hop</th><th>Cost</th></tr>
                            ${Object.entries(routingTables[router]).map(([dest, info]) => `
                                <tr>
                                    <td>${dest}</td>
                                    <td>${info.next_hop}</td>
                                    <td>${info.cost}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>`;
    }
    document.getElementById('stepHistory').innerHTML = tablesHtml;
}

function startLSRProcess() {
    console.log("Starting LSR Process");

    // First start neighbor discovery
    fetch('/start_discovery', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            routers: nodes.get().map(node => node.id),
            links: edges.get().map(edge => ({
                source: edge.from,
                target: edge.to,
                cost: parseInt(edge.label)
            }))
        })
    })
        .then(response => response.json())
        .then(data => {
            // Calculate total duration of neighbor discovery animations
            const steps = data.steps;
            const neighborsPerStep = steps.map(step => step.discovered_neighbors.length);
            const totalNeighbors = neighborsPerStep.reduce((sum, count) => sum + count, 0);

            // Calculate total duration based on animation timings
            const stepDelay = 4000; // Delay between router steps
            const neighborDelay = 2500; // Delay between neighbors
            const packetDuration = 2400; // Duration for hello + reply + gaps

            // Total duration = (number of steps × step delay) + (total neighbors × neighbor delay)
            const totalDuration = (steps.length * stepDelay) + (totalNeighbors * neighborDelay);

            // Display neighbor discovery animations
            displayNeighborDiscoverySteps(data.steps);

            // Start flooding after neighbor discovery completes
            setTimeout(() => {
                console.log("Starting LSP Flooding");
                fetch('/start_flooding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        routers: nodes.get().map(node => node.id),
                        links: edges.get().map(edge => ({
                            source: edge.from,
                            target: edge.to,
                            cost: parseInt(edge.label)
                        }))
                    })
                })
                    .then(response => response.json())
                    .then(data => {
                        displayLSPFloodingSteps(data.steps);

                        // Calculate total duration of flooding animations
                        const floodingDuration = calculateFloodingDuration(data.steps);

                        // Start routing table calculation after flooding completes
                        setTimeout(() => {
                            console.log("Building Routing Tables");
                            buildRoutingTables();
                        }, floodingDuration + 500); // Add 0.5 second buffer
                    })
                    .catch(error => {
                        console.error('Error during LSP flooding:', error);
                        alert('An error occurred during LSP flooding: ' + error.message);
                    });
            }, totalDuration + 500); // Add 0.5 second buffer between phases
        })
        .catch(error => {
            console.error('Error during neighbor discovery:', error);
            alert('An error occurred during neighbor discovery: ' + error.message);
        });
}

// Helper function to calculate flooding animation duration
function calculateFloodingDuration(steps) {
    const baseDelay = 5000; // Base delay between different LSP sources
    const propagationDelay = 1000; // Delay between hops

    // Calculate maximum network diameter (longest possible path)
    const networkDiameter = calculateNetworkDiameter();

    // Total duration = (number of steps × base delay) + (max propagation levels × propagation delay)
    return (steps.length * baseDelay) + (networkDiameter * propagationDelay);
}

// Helper function to estimate network diameter
function calculateNetworkDiameter() {
    const routerCount = nodes.get().length;
    // Simple estimation - in worst case, might need to traverse all nodes
    // In practice, this is usually less, but we want to ensure enough time
    return routerCount;
}

// Function to reset any ongoing animations and network state
function resetNetworkState() {
    // Clear any existing animations
    nodes.get().forEach(node => {
        nodes.update({
            id: node.id,
            color: {
                background: '#4CAF50',
                border: '#45a049'
            }
        });
    });

    edges.get().forEach(edge => {
        edges.update({
            id: edge.id,
            color: { color: '#848484' },
            width: 2
        });
    });
}

// Update the individual phase functions to reset state before starting
function showNeighborDiscovery() {
    resetNetworkState();
    startNeighborDiscovery();
}

function showFlooding() {
    resetNetworkState();
    startLSPFlooding();
}

function showRoutingTables() {
    resetNetworkState();
    buildRoutingTables();
}

// Initialize the network when the page loads
window.addEventListener('load', () => {
    initNetwork();
    updateSelects();
});