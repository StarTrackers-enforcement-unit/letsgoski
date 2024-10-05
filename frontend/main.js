import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Very dark gray instead of black

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
camera.position.set(0, 50, 150); // Positioned camera back and up

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lights
const starLight = new THREE.PointLight(0xffffff, 5, 1000); // Increased intensity
starLight.position.set(0, 0, 0);
scene.add(starLight);

const ambientLight = new THREE.AmbientLight(0x404040, 1); // Increased intensity
scene.add(ambientLight);

// Audio setup
const listener = new THREE.AudioListener();
camera.add(listener);

let backgroundMusic;

const audioLoader = new THREE.AudioLoader();
audioLoader.load('/music.mp3', (buffer) => {
    backgroundMusic = new THREE.Audio(listener);
    backgroundMusic.setBuffer(buffer);
    backgroundMusic.setLoop(true);
    backgroundMusic.setVolume(0.5);
}, undefined, (error) => {
    console.error('Error loading audio:', error);
});

// Skybox
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skyboxMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide
});
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
scene.add(skybox);

// Star field
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });

const starsVertices = [];
/* for (let i = 0; i < 10000; i++) {
    const x = THREE.MathUtils.randFloatSpread(1000);
    const y = THREE.MathUtils.randFloatSpread(1000);
    const z = THREE.MathUtils.randFloatSpread(1000);
    starsVertices.push(x, y, z);
} */

starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 2));
const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tooltip setup
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
tooltip.style.color = 'white';
tooltip.style.padding = '10px';
tooltip.style.borderRadius = '5px';
tooltip.style.display = 'none';
tooltip.style.pointerEvents = 'none';
document.body.appendChild(tooltip);

let planets = [];
let nearbyStars = [];

function startMusic() {
    if (backgroundMusic) {
        backgroundMusic.play();
    } else {
        console.error("Music is not loaded yet.");
    }
}

async function loadExoplanet() {
    const planetName = document.getElementById('planetName').value;
    if (planetName) {
        try {
            const response = await fetch(`http://localhost:3000/exoplanet?name=${planetName}`);
            const jsonData = await response.json();

            if (jsonData.exoplanet) {
                const planetData = jsonData.exoplanet;
                const nearbyObjects = jsonData.nearbyObjects || [];
                visualizeExoplanets(planetData, nearbyObjects);
                
                startMusic();
            } else {
                alert('No valid data found for this exoplanet!');
            }
        } catch (error) {
            alert('Error fetching exoplanet data!');
            console.error('Fetch error:', error);
        }
    } else {
        alert('Please enter a valid exoplanet name.');
    }
}


function clearPreviousVisualizations() {
    planets.forEach(planet => scene.remove(planet));
    nearbyStars.forEach(star => scene.remove(star));
    planets = [];
    nearbyStars = [];
}

function createPlanetSphere(radius, color) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: 0.5
    });
    return new THREE.Mesh(geometry, material);
}

function createAtmosphere(radius) {
    const atmosphereGeometry = new THREE.SphereGeometry(radius + 0.5, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });
    return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
}


function createOrbit(orbitRadius) {
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const orbitPoints = [];
    
    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius));
    }
    
    orbitGeometry.setFromPoints(orbitPoints);
    return new THREE.Line(orbitGeometry, orbitMaterial);
}

function getColorByTemperature(temp) {
    if (temp < 3000) return 0x8B4513; // Brownish
    if (temp < 4000) return 0xFFA500; // Orange
    if (temp < 6000) return 0xFFD700; // Yellow
    if (temp < 7500) return 0xFFFFFF; // White
    return 0xADD8E6; // Blue
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData && (object.userData.type === "planet" || object.userData.type === "nearbyPlanet")) {
            displayTooltip(event, object.userData);
        }
    } else {
        tooltip.style.display = 'none';
    }
}

function displayTooltip(event, data) {
    let tooltipContent = '';
    tooltipContent += `<strong>${data.pl_name.replace(/"/g, '')}</strong><br>`;
    if (data.pl_rade) tooltipContent += `Radius: ${parseFloat(data.pl_rade).toFixed(2)} Earth radii<br>`;
    tooltipContent += `Distance: ${parseFloat(data.sy_dist).toFixed(2)} parsecs<br>`;
    if (data.st_teff) tooltipContent += `Star Temperature: ${parseFloat(data.st_teff).toFixed(0)} K`;
    
    tooltip.innerHTML = tooltipContent;
    tooltip.style.left = event.clientX + 10 + 'px';
    tooltip.style.top = event.clientY + 10 + 'px';
    tooltip.style.display = 'block';
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Update planet positions
    updatePlanetPositions(planets);
    updatePlanetPositions(nearbyStars);

    renderer.render(scene, camera);
}

function visualizeExoplanets(planetData, nearbyObjects) {
    console.log('Visualizing exoplanets:', planetData, nearbyObjects); // Debug log

    // Clear previous visualizations
    clearPreviousVisualizations();

    // Visualize the main exoplanet
    const color = getColorByTemperature(parseFloat(planetData.st_teff) || 7500);
    const radius = Math.max(parseFloat(planetData.pl_rade) * 10, 1); // Scale radius for visibility
    const sphere = createPlanetSphere(radius, color);
    
    // Assign inclination from planet data
    sphere.userData = { ...planetData, type: "planet", inclination: parseFloat(planetData.dec) || 0 }; 
    scene.add(sphere);
    planets.push(sphere);

    // Add atmosphere
    const atmosphere = createAtmosphere(radius);
    sphere.add(atmosphere);

    // Visualize nearby objects
    visualizeNearbyObjects(nearbyObjects);
}

function visualizeNearbyObjects(nearbyObjects) {
    nearbyObjects.forEach((nearbyPlanet, index) => {
        const color = getColorByTemperature(parseFloat(nearbyPlanet.st_teff) || 3000);
        const nearbySphere = createPlanetSphere(2, color);
        
        
        const inclination = parseFloat(nearbyPlanet.dec) || 0;
        nearbySphere.userData = { ...nearbyPlanet, type: "nearbyPlanet", orbitRadius: 20 + (index + 1) * 15, orbitSpeed: 0.001 / (index + 1), inclination };
        scene.add(nearbySphere);
        nearbyStars.push(nearbySphere);
    });
}

function updatePlanetPositions(objects) {
    objects.forEach(object => {
        console.log(object)
        const { orbitRadius, orbitSpeed, inclination } = object.userData;
        if (orbitRadius && orbitSpeed) {
            const time = Date.now() * orbitSpeed;
            const angle = time % (Math.PI * 2); // Modulo for continuous looping

            // Update positions based on inclination
            object.position.x = Math.cos(angle) * orbitRadius;
            object.position.y = Math.sin(inclination) * orbitRadius; // Vertical position based on inclination
            object.position.z = Math.sin(angle) * orbitRadius * Math.cos(inclination); // Horizontal movement adjusted for inclination
        }
    });
}



function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function addAxisHelper() {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
}

// Event listeners
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('resize', onWindowResize, false);
document.getElementById('loadButton').addEventListener('click', loadExoplanet);

// Initialize
addAxisHelper();
animate();

// Expose loadExoplanet to global scope for the button to access
window.loadExoplanet = loadExoplanet;
