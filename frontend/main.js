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

// First-person camera
const fpCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
fpCamera.position.set(0, 0, 0);

let currentCamera = camera;

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
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ 
    vertexColors: true,
    size: 20, 
    sizeAttenuation: true 
});

const starsVertices = [];
const starColors = [];
const color = new THREE.Color();

for (let i = 0; i < 50000; i++) {
    const x = THREE.MathUtils.randFloatSpread(100000);
    const y = THREE.MathUtils.randFloatSpread(100000);
    const z = THREE.MathUtils.randFloatSpread(100000);
    starsVertices.push(x, y, z);

    color.setHSL(THREE.MathUtils.randFloat(0.5, 0.75), 1.0, THREE.MathUtils.randFloat(0.5, 1.0));
    starColors.push(color.r, color.g, color.b);
}

starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
    scene.remove(starField);
    starsGeometry.dispose();
    starsMaterial.dispose();
    planets.forEach(planet => scene.remove(planet));
    nearbyStars.forEach(star => scene.remove(star));
    planets = [];
    nearbyStars = [];
}

function createPlanetSphere(radius, color, texturePath = null, normalMapPath = null) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    
    let material;
    
    const textureLoader = new THREE.TextureLoader();

    if (texturePath) {
        const planetTexture = textureLoader.load(texturePath);

        material = new THREE.MeshStandardMaterial({
            map: planetTexture,
            roughness: 0.7,
            metalness: 0.2,
            emissive: color,
            emissiveIntensity: 0.5
        });

        // Add normal map if provided
        if (normalMapPath) {
            const normalTexture = textureLoader.load(normalMapPath);
            material.normalMap = normalTexture;
            material.normalScale.set(1, 1); // Adjust the intensity of the normal map
        }
    } else {
        // Fallback to plain color if no texture is provided
        material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.7,
            metalness: 0.2,
            emissive: color,
            emissiveIntensity: 0.5
        });
    }

    return new THREE.Mesh(geometry, material);
}


/* function createAtmosphere(radius) {
    const atmosphereGeometry = new THREE.SphereGeometry(radius + 0.5, 32, 32);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });
    return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
} */

function getColorByTemperature(temp) {
    if (temp < 3000) return 0x8B4513; // Brownish
    if (temp < 4000) return 0xFFA500; // Orange
    if (temp < 6000) return 0xFFD700; // Yellow
    if (temp < 7500) return 0xFFFFFF; // White
    return 0xADD8E6; // Blue
}
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
}
function visualizeExoplanets(planetData, nearbyObjects) {
    console.log('Visualizing exoplanets:', planetData, nearbyObjects); // Debug log

    clearPreviousVisualizations();

    const radius = Math.max(parseFloat(planetData.pl_rade) * 10, 1); // Scale radius for visibility

    // Use the path to your texture image and normal map
    const planetTexturePath = '/moon.jpg';
    const normalMapPath = '/normal.jpg';

    const sphere = createPlanetSphere(radius, planetTexturePath, normalMapPath);
    
    sphere.position.set(0, 0, 0);
    
    sphere.userData = { ...planetData, type: "planet" }; 
    scene.add(sphere);
    planets.push(sphere);

    /* const atmosphere = createAtmosphere(radius);
    sphere.add(atmosphere); */

    // Position first-person camera on the planet surface
    fpCamera.position.set(0, radius + 0.1, 0);
    fpCamera.lookAt(0, radius + 1, radius);

    visualizeNearbyObjects(nearbyObjects);
}


function visualizeNearbyObjects(nearbyObjects) {
    const skyRadius = 1000; // Large radius to simulate sky-like distribution
    const maxObjects = 10000; // Limit the number of objects to render

    const geometry = new THREE.SphereGeometry(1, 8, 8); // Reduced segment count

    nearbyObjects.slice(0, maxObjects).forEach((nearbyPlanet) => {
        const material = new THREE.MeshBasicMaterial({color: getColorByTemperature(parseFloat(nearbyPlanet.st_teff) || 7500)});
        const mesh = new THREE.Mesh(geometry, material);
        
        const ra = THREE.MathUtils.degToRad(parseFloat(nearbyPlanet.ra) || 0);
        const dec = THREE.MathUtils.degToRad(parseFloat(nearbyPlanet.dec) || 0);
        
        mesh.position.set(
            -skyRadius * Math.cos(dec) * Math.cos(ra),
            skyRadius * Math.sin(dec),
            skyRadius * Math.cos(dec) * Math.sin(ra)
        );
        
        mesh.userData = { name: nearbyPlanet.pl_name || "Unknown", type: "nearbyPlanet" };
        scene.add(mesh);
        nearbyStars.push(mesh);
    });

    window.addEventListener('mousemove', onMouseMove);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, currentCamera);
    const intersects = raycaster.intersectObjects(nearbyStars);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        displayTooltip(event, object.userData);
    } else {
        hideTooltip();
    }
}

function displayTooltip(event, data) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = data.name;
    tooltip.style.left = event.clientX + 10 + 'px';
    tooltip.style.top = event.clientY + 10 + 'px';
    tooltip.style.display = 'block';
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    fpCamera.aspect = window.innerWidth / window.innerHeight;
    fpCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function addAxisHelper() {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
}

function togglePerspective() {
    if (currentCamera === camera) {
        currentCamera = fpCamera;
        controls.enabled = false;
    } else {
        currentCamera = camera;
        controls.enabled = true;
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Rotate the planet
    if (planets.length > 0) {
        planets[0].rotation.y -= 0.001; // Adjust the rotation speed as needed
    }
    
    // Rotate the first-person camera if it's active
    if (currentCamera === fpCamera) {
        fpCamera.rotation.y += 0.001; // Adjust the rotation speed as needed
    }
    
    controls.update();
    renderer.render(scene, currentCamera);
}

// Event listeners
window.addEventListener('resize', onWindowResize, false);
document.getElementById('loadButton').addEventListener('click', loadExoplanet);
document.getElementById('perspectiveButton').addEventListener('click', togglePerspective);

// Initialize
setupLighting();
addAxisHelper();
animate();

// Expose loadExoplanet to global scope for the button to access
window.loadExoplanet = loadExoplanet;