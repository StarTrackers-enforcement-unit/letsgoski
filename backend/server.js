const express = require('express');
const request = require('request');
const cors = require('cors');
const app = express();

// Enable CORS for all requests
app.use(cors());

// Proxy route to fetch exoplanet data and nearby stars and planets
app.get('/exoplanet', (req, res) => {
    const exoplanetName = req.query.name;

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

        // Fetch nearby stars and planets (assuming a distance of 10 light years)
        const distance = 10; // Change as needed
        const nearbyQuery = `SELECT pl_name, sy_dist, st_teff, ra, dec FROM ps WHERE sy_dist <= ${distance} AND pl_name <> '${exoplanetName}'`;
        console.log(`Nearby Objects Query: ${nearbyQuery}`); // Log the nearby objects query for debugging

        const nearbyTAPUrl = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(nearbyQuery)}&format=csv`;

        // Fetch nearby stars and planets
        request(nearbyTAPUrl, (error, response, body) => {
            if (error) {
                console.error(`Error fetching nearby objects: ${error}`);
                return res.status(500).send('Error fetching nearby objects from the TAP service');
            }

            const nearbyCsvData = body.trim();
            if (nearbyCsvData === "pl_name,sy_dist,st_teff,ra,dec") {
                return res.status(404).send('No nearby objects found.');
            }

            // Parse nearby stars and planets data
            const nearbyRows = nearbyCsvData.split('\n').slice(1); // Skip header
            const nearbyObjects = nearbyRows.map(row => {
                const [pl_name, sy_dist, st_teff, ra, dec] = row.split(',');
                return { pl_name, sy_dist, st_teff, ra: parseFloat(ra), dec: parseFloat(dec) };
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
