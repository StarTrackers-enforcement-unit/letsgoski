const express = require('express');
const request = require('request');
const cors = require('cors');
const app = express();

// Enable CORS for all requests
app.use(cors());

// Utility function to calculate distance between two celestial objects using RA and Dec
const calculateDistance = (ra1, dec1, ra2, dec2) => {
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    const dRa = toRadians(ra2 - ra1);
    const dDec = toRadians(dec2 - dec1);
    const a = Math.sin(dDec / 2) ** 2 + Math.cos(toRadians(dec1)) * Math.cos(toRadians(dec2)) * Math.sin(dRa / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));
    const distance = 6371 * c; // Distance in kilometers (using Earth's radius)
    return distance; // Return distance
};

// Proxy route to fetch exoplanet data and nearby stars and planets
app.get('/exoplanet', (req, res) => {
    const exoplanetName = req.query.name;

    // Validate query parameter
    if (!exoplanetName) {
        return res.status(400).send('Exoplanet name is required.');
    }

    // Construct the TAP query to fetch exoplanet details including RA and Dec
    const exoplanetQuery = `SELECT pl_name, pl_rade, sy_dist, st_teff, ra, dec FROM ps WHERE pl_name='${exoplanetName}'`;
    console.log(`Exoplanet Query: ${exoplanetQuery}`); // Log the TAP query for debugging

    // TAP endpoint for synchronous queries
    const exoplanetTAPUrl = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(exoplanetQuery)}&format=csv`;
    console.log(exoplanetTAPUrl);
    
    // Fetch exoplanet data
    request(exoplanetTAPUrl, (error, response, body) => {
        if (error) {
            console.error(`Error fetching exoplanet data: ${error}`);
            return res.status(500).send('Error fetching data from the TAP service');
        }

        const csvData = body.trim();
        if (csvData === "pl_name,pl_rade,sy_dist,st_teff,ra,dec") {
            return res.status(404).send('No data found for this exoplanet!');
        }

        // Parse the exoplanet data
        const exoplanetRows = csvData.split('\n').slice(1); // Skip header
        const exoplanetDetails = exoplanetRows.map(row => {
            const [pl_name, pl_rade, sy_dist, st_teff, ra, dec] = row.split(',');
            return { pl_name, pl_rade, sy_dist, st_teff, ra: parseFloat(ra), dec: parseFloat(dec) };
        })[0]; // Get the first result (assuming unique names)

        if (!exoplanetDetails) {
            return res.status(404).send('No details found for the specified exoplanet.');
        }

        // Fetch all stars and planets (no distance limit for this query)
        const allStarsQuery = `SELECT pl_name, sy_dist, st_teff, ra, dec FROM ps WHERE pl_name <> '${exoplanetName}'`;
        console.log(`All Stars Query: ${allStarsQuery}`); // Log the nearby objects query for debugging

        const allStarsTAPUrl = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(allStarsQuery)}&format=csv`;

        // Fetch all stars and planets
        request(allStarsTAPUrl, (error, response, body) => {
            if (error) {
                console.error(`Error fetching all stars: ${error}`);
                return res.status(500).send('Error fetching stars from the TAP service');
            }

            const allStarsCsvData = body.trim();
            if (allStarsCsvData === "pl_name,sy_dist,st_teff,ra,dec") {
                return res.status(404).send('No nearby objects found.');
            }

            // Parse all stars and planets data
            const allStarsRows = allStarsCsvData.split('\n').slice(1); // Skip header
            const allStars = allStarsRows.map(row => {
                const [pl_name, sy_dist, st_teff, ra, dec] = row.split(',');
                return { pl_name, sy_dist: parseFloat(sy_dist), st_teff, ra: parseFloat(ra), dec: parseFloat(dec) };
            });

            // Find nearby stars and planets based on distance from the exoplanet
            const nearbyDistanceLimit = 1000; // Distance limit in kilometers, adjust as needed
            const nearbyObjects = allStars.filter(star => {
                const distance = calculateDistance(exoplanetDetails.ra, exoplanetDetails.dec, star.ra, star.dec);
                return distance <= nearbyDistanceLimit;
            });

            // Combine results
            const responseData = {
                exoplanet: exoplanetDetails,
                nearbyObjects: nearbyObjects
            };

            // Send the combined data back to the frontend
            res.json(responseData);
        });
    });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
