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
const skyboxGeometry = new THREE.BoxGeometry(100000, 100000, 100000);
const skyboxMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide
});
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
scene.add(skybox);

// Star field
// Create the stars geometry and material
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ 
    vertexColors: true,   // Enable vertex colors
    size: 20, 
    sizeAttenuation: true 
});

// Generate vertices and colors for the stars
const starsVertices = [];
const starColors = [];
const color = new THREE.Color();

for (let i = 0; i < 50000; i++) {
    const x = THREE.MathUtils.randFloatSpread(100000);
    const y = THREE.MathUtils.randFloatSpread(100000);
    const z = THREE.MathUtils.randFloatSpread(100000);
    starsVertices.push(x, y, z);

    // Random cool colors (shades of blue, purple, white)
    color.setHSL(THREE.MathUtils.randFloat(0.5, 0.75), 1.0, THREE.MathUtils.randFloat(0.5, 1.0));  // Cool color range (0.5 to 0.75 HSL)
    starColors.push(color.r, color.g, color.b);
}

starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// Function to clear stars from the scene
function clearFakeStars() {
    scene.remove(starField); // Remove from scene
    starsGeometry.dispose(); // Dispose of geometry
    starsMaterial.dispose(); // Dispose of material
}

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/* // Tooltip setup
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
tooltip.style.color = 'white';
tooltip.style.padding = '10px';
tooltip.style.borderRadius = '5px';
tooltip.style.display = 'none';
tooltip.style.pointerEvents = 'none';
document.body.appendChild(tooltip);
 */
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
            const response = await fetch(`https://nasacdn.smartlinux.xyz/exoplanet?name=${planetName}`);
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
    clearFakeStars();
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


function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Update planet positions
   /*  updatePlanetPositions(planets);
    updatePlanetPositions(nearbyStars);  */

    renderer.render(scene, camera);
}

function visualizeExoplanets(planetData, nearbyObjects) {
    console.log('Visualizing exoplanets:', planetData, nearbyObjects); // Debug log

    // Clear previous visualizations
    clearPreviousVisualizations();

    // Visualize the main exoplanet
    const color = 0x50C878;
    const radius = Math.max(parseFloat(planetData.pl_rade) * 10, 1); // Scale radius for visibility
    const sphere = createPlanetSphere(radius, color);
    
    // Position the main planet at the center
    sphere.position.set(0, 0, 0);
    
    sphere.userData = { ...planetData, type: "planet" }; 
    scene.add(sphere);
    planets.push(sphere);

    // Add atmosphere
    const atmosphere = createAtmosphere(radius);
    sphere.add(atmosphere);

    // Visualize nearby objects
    visualizeNearbyObjects(nearbyObjects);
}

function visualizeNearbyObjects(nearbyObjects) {
    const skyRadius = 1000; // Large radius to simulate sky-like distribution
    const maxObjects = 10000; // Limit the number of objects to render

    // Create a single geometry and material for all nearby objects
    const geometry = new THREE.SphereGeometry(1, 8, 8); // Reduced segment count
    

    // Create a single BufferGeometry for all connecting lines
    /* const lineGeometry = new THREE.BufferGeometry();
    const linePositions = [];
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
 */
    nearbyObjects.slice(0, maxObjects).forEach((nearbyPlanet) => {
        const material = new THREE.MeshBasicMaterial(getColorByTemperature(parseFloat(nearbyPlanet.st_teff) || 7500));
        const mesh = new THREE.Mesh(geometry, material);
        
        // Use the object's properties to determine its position
        const ra = THREE.MathUtils.degToRad(parseFloat(nearbyPlanet.ra) || 0);
        const dec = THREE.MathUtils.degToRad(parseFloat(nearbyPlanet.dec) || 0);
        
        // Convert RA and Dec to Cartesian coordinates
        mesh.position.set(
            -skyRadius * Math.cos(dec) * Math.cos(ra),
            skyRadius * Math.sin(dec),
            skyRadius * Math.cos(dec) * Math.sin(ra)
        );
        
        mesh.userData = { name: nearbyPlanet.pl_name || "Unknown", type: "nearbyPlanet" };
        scene.add(mesh);
        nearbyStars.push(mesh);

        // Add line positions
       /*  linePositions.push(0, 0, 0, mesh.position.x, mesh.position.y, mesh.position.z); */
    });

    // Create a single line object for all connecting lines
    /* lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines); */

    // Add event listener for showing object names on hover
    window.addEventListener('mousemove', onMouseMove);
}

// Update the onMouseMove function to show object names
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nearbyStars);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        displayTooltip(event, object.userData);
    } else {
        hideTooltip();
    }
}

function displayTooltip(event, data) {
    tooltip.textContent = data.name;
    tooltip.style.left = event.clientX + 10 + 'px';
    tooltip.style.top = event.clientY + 10 + 'px';
    tooltip.style.display = 'block';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

function updatePlanetPositions(objects) {
    objects.forEach(object => {
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
const tooltip = document.getElementById('tooltip');
window.addEventListener('resize', onWindowResize, false);
document.getElementById('loadButton').addEventListener('click', loadExoplanet);
/* document.getElementById('perspectiveButton').addEventListener('click', togglePerspective); */

// Initialize
addAxisHelper();
animate();

// Expose loadExoplanet to global scope for the button to access
window.loadExoplanet = loadExoplanet;
