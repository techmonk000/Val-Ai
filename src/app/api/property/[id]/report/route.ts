import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/config/db';
import PropertyValuation from '@/models/PropertyValuation';
import * as ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { uploadToOneDrive } from '@/lib/onedrive';
import { generatePDFUsingWin32 } from '@/lib/pdf'; // ✅ Win32 PDF function
import sharp from 'sharp';
import { Buffer } from 'buffer';
import { getOneDriveDownloadUrl, tokenManager } from '@/lib/onedrive-token';

async function generateCustomMapImage(address: string, apiKey: string, fullAddressLabel: string): Promise<Buffer> {
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=14&size=600x400&maptype=roadmap&markers=color:red%7C${encodeURIComponent(address)}&key=${apiKey}`;

  const arrayBuffer = await fetch(mapUrl).then(res => res.arrayBuffer());

  const nodeBuffer = Buffer.from(arrayBuffer); 

  const svgText = `
    <svg width="600" height="60">
      <rect x="0" y="0" width="600" height="60" fill="white"/>
      <text x="50%" y="50%" font-size="20" font-family="Arial" fill="black" text-anchor="middle" alignment-baseline="middle">
        ${fullAddressLabel}
      </text>
    </svg>
  `;

  const finalBuffer = await sharp(nodeBuffer)
    .extend({ top: 60, background: 'white' })
    .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return finalBuffer;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await context.params;

  try {
    const property: any = await PropertyValuation.findById(id).lean();
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve(process.cwd(), 'public/templates/AAP-Report.xlsx');
    await workbook.xlsx.readFile(templatePath);
    workbook.calcProperties.fullCalcOnLoad = true;

    const filloutSheet = workbook.getWorksheet('Fillout');
    if (!filloutSheet) {
      throw new Error('Fillout sheet not found in template');
    }

    // ✅ Set values directly into specific cells under existing labels
    const overview = property.overview || {};
    const valuationDetails = property.valuationDetails || {};
    const propertyDetails = property.propertyDetails || {};
    const propertyDescriptors = property.propertyDescriptors || {};
    const roomFeaturesFixtures = property.roomFeaturesFixtures || {};
    const locationAndNeighborhood = property.locationAndNeighborhood || {};
    const siteDetails = property.siteDetails || {};
    const ancillaryImprovements = property.ancillaryImprovements || {};
    const generalComments = property.generalComments || {};
    
    filloutSheet.getCell('B2').value = overview.jobNumber || '';
    filloutSheet.getCell('C2').value = overview.closedByz || '';
    filloutSheet.getCell('D2').value = overview.propertyValuer || '';
    filloutSheet.getCell('E2').value = overview.reportType || '';
    filloutSheet.getCell('F2').value = overview.valuationType || '';
    filloutSheet.getCell('G2').value = overview.addressStreet || '';
    filloutSheet.getCell('H2').value = overview.addressSuburb || '';
    filloutSheet.getCell('I2').value = overview.addressState || '';
    filloutSheet.getCell('J2').value = overview.addressPostcode || '';
    filloutSheet.getCell('K2').value = overview.propertyType || '';
    filloutSheet.getCell('L2').value = overview.valuationNotes || '';
    filloutSheet.getCell('M2').value = overview.dateOfValuation || '';
    filloutSheet.getCell('N2').value = valuationDetails.clientsExpectedValue || '';
    filloutSheet.getCell('O2').value = overview.surveyType || '';
    filloutSheet.getCell('P2').value = overview.dateOfInspection || '';
    filloutSheet.getCell('Q2').value = valuationDetails.valuersGuaranteedValue || '';
    filloutSheet.getCell('R2').value = valuationDetails.requestedValuationTarget || '';
    filloutSheet.getCell('B22').value = overview.dateOfValuation || '';
    filloutSheet.getCell('B24').value = overview.dateOfValuation || '';
    filloutSheet.getCell('B27').value = propertyDetails.buildYear || '';
    filloutSheet.getCell('B28').value = propertyDetails.titleReference || '';
    filloutSheet.getCell('B29').value = propertyDetails.councilArea || '';
    filloutSheet.getCell('B31').value = propertyDetails.zoning || '';
    filloutSheet.getCell('B32').value = propertyDetails.permissibleUses || '';
    filloutSheet.getCell('B33').value = propertyDetails.landShape || '';
    filloutSheet.getCell('B34').value = propertyDetails.landSlope || '';
    filloutSheet.getCell('B35').value = propertyDetails.frontage || '';
    filloutSheet.getCell('B36').value = propertyDetails.depth || '';
    filloutSheet.getCell('B37').value = propertyDetails.siteArea || '';
    filloutSheet.getCell('B38').value = propertyDetails.livingArea || '';
    filloutSheet.getCell('B39').value = propertyDetails.externalArea || '';
    filloutSheet.getCell('B44').value = locationAndNeighborhood.suburbDescription || '';
    filloutSheet.getCell('B45').value = locationAndNeighborhood.addressStreet || '';
    filloutSheet.getCell('B46').value = locationAndNeighborhood.connectedStreet?.name || '';
    filloutSheet.getCell('B47').value = locationAndNeighborhood.publicTransport?.type || '';
    filloutSheet.getCell('B48').value = locationAndNeighborhood.publicTransport?.name || '';
    filloutSheet.getCell('B49').value = locationAndNeighborhood.publicTransport?.distance || '';
    filloutSheet.getCell('B50').value = locationAndNeighborhood.shop?.type || '';
    filloutSheet.getCell('B51').value = locationAndNeighborhood.shop?.distance || '';
    filloutSheet.getCell('B52').value = locationAndNeighborhood.primarySchool?.name || '';
    filloutSheet.getCell('B53').value = locationAndNeighborhood.primarySchool?.distance || '';
    filloutSheet.getCell('B54').value = locationAndNeighborhood.highSchool?.name || '';
    filloutSheet.getCell('B55').value = locationAndNeighborhood.highSchool?.distance || '';
    filloutSheet.getCell('B56').value = locationAndNeighborhood.cbd?.name || '';
    filloutSheet.getCell('B57').value = locationAndNeighborhood.cbd?.distance || '';
    filloutSheet.getCell('B58').value = locationAndNeighborhood.includesGas || '';
    filloutSheet.getCell('B63').value = siteDetails.mapSource || '';
    filloutSheet.getCell('B66').value = propertyDescriptors.mainBuildingType || '';
    filloutSheet.getCell('B67').value = propertyDescriptors.externalWalls || '';
    filloutSheet.getCell('B68').value = propertyDescriptors.internalWalls || '';
    filloutSheet.getCell('B69').value = propertyDescriptors.roofing || '';
    filloutSheet.getCell('B70').value = propertyDescriptors.numberOfBedrooms || '';
    filloutSheet.getCell('B71').value = propertyDescriptors.numberOfBathrooms || '';
    filloutSheet.getCell('B72').value = propertyDescriptors.parkingType || '';
    filloutSheet.getCell('B75').value = propertyDescriptors.internalCondition || '';
    filloutSheet.getCell('B76').value = propertyDescriptors.externalCondition || '';
    filloutSheet.getCell('B77').value = propertyDescriptors.repairRequirements || '';
    filloutSheet.getCell('B78').value = propertyDescriptors.defects || '';
    filloutSheet.getCell('B83').value = ancillaryImprovements.driveway || '';
    filloutSheet.getCell('B84').value = ancillaryImprovements.fencing || '';
    filloutSheet.getCell('B85').value = ancillaryImprovements.otherImprovements || '';
    filloutSheet.getCell('B88').value = roomFeaturesFixtures?.rooms?.["Bedroom 1"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B89').value = roomFeaturesFixtures?.rooms?.["Bedroom 2"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B90').value = roomFeaturesFixtures?.rooms?.["Bedroom 3"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B91').value = roomFeaturesFixtures?.rooms?.["Bedroom 4"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B92').value = roomFeaturesFixtures?.rooms?.["Bedroom 5"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B93').value = roomFeaturesFixtures?.rooms?.["Bedroom 6"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B94').value = roomFeaturesFixtures?.rooms?.["Bathroom"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B95').value = roomFeaturesFixtures?.rooms?.["Ensuite"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B96').value = roomFeaturesFixtures?.rooms?.["Study"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B97').value = roomFeaturesFixtures?.rooms?.["Kitchen"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B98').value = roomFeaturesFixtures?.rooms?.["Living"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B99').value = roomFeaturesFixtures?.rooms?.["Dining"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B100').value = roomFeaturesFixtures?.rooms?.["Lounge"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B101').value = roomFeaturesFixtures?.rooms?.["Rumpus"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B102').value = roomFeaturesFixtures?.rooms?.["Sunroom"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B103').value = roomFeaturesFixtures?.rooms?.["Storage area"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B104').value = roomFeaturesFixtures?.rooms?.["Workshop"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B105').value = roomFeaturesFixtures?.rooms?.["Porch"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B106').value = roomFeaturesFixtures?.rooms?.["Alfresco"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B107').value = roomFeaturesFixtures?.rooms?.["Patio"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B108').value = roomFeaturesFixtures?.rooms?.["Balcony"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B109').value = roomFeaturesFixtures?.rooms?.["Laundry"]?.extraItems?.join(", ") || '';
    filloutSheet.getCell('B110').value = roomFeaturesFixtures?.rooms?.["General"]?.extraItems?.join(", ") || '';

    filloutSheet.getCell('B113').value = roomFeaturesFixtures?.rooms?.["Bedroom 1"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B114').value = roomFeaturesFixtures?.rooms?.["Bedroom 2"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B115').value = roomFeaturesFixtures?.rooms?.["Bedroom 3"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B116').value = roomFeaturesFixtures?.rooms?.["Bedroom 4"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B117').value = roomFeaturesFixtures?.rooms?.["Bedroom 5"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B118').value = roomFeaturesFixtures?.rooms?.["Bedroom 6"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B119').value = roomFeaturesFixtures?.rooms?.["Bathroom"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B120').value = roomFeaturesFixtures?.rooms?.["Ensuite"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B121').value = roomFeaturesFixtures?.rooms?.["Study"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B122').value = roomFeaturesFixtures?.rooms?.["Kitchen"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B123').value = roomFeaturesFixtures?.rooms?.["Dining"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B124').value = roomFeaturesFixtures?.rooms?.["Living"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B125').value = roomFeaturesFixtures?.rooms?.["Lounge"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B126').value = roomFeaturesFixtures?.rooms?.["Rumpus"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B127').value = roomFeaturesFixtures?.rooms?.["Sunroom"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B128').value = roomFeaturesFixtures?.rooms?.["Storage area"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B129').value = roomFeaturesFixtures?.rooms?.["Workshop"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B130').value = roomFeaturesFixtures?.rooms?.["Porch"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B131').value = roomFeaturesFixtures?.rooms?.["Alfresco"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B132').value = roomFeaturesFixtures?.rooms?.["Patio"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B133').value = roomFeaturesFixtures?.rooms?.["Balcony"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B134').value = roomFeaturesFixtures?.rooms?.["Laundry"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B135').value = roomFeaturesFixtures?.rooms?.["General"]?.flooringTypes?.join(", ") || '';
    filloutSheet.getCell('B143').value = generalComments.marketOverview || '';
    filloutSheet.getCell('B182').value = valuationDetails.landValue || '';
    filloutSheet.getCell('B183').value = valuationDetails.improvements || '';
    filloutSheet.getCell('B184').value = valuationDetails.marketValue || '';

    // 🧹 Photos Sheet
    const photoSheet = workbook.getWorksheet('Photos');
    if (!photoSheet) {
      throw new Error('Photos sheet not found in template');
    }

    const photos = property.photos || {};
    const exteriorPhotos = photos.exteriorPhotos || [];
    const interiorPhotos = photos.interiorPhotos || [];
    const additionalPhotos = photos.additionalPhotos || [];
    const reportCoverPhoto = photos.reportCoverPhoto || [];

    const fullAddressLabel = `${overview.addressStreet}, ${overview.addressSuburb}, ${overview.addressState} ${overview.addressPostcode}`;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    // Generate and add map image
    const mapImageBuffer = await generateCustomMapImage(fullAddressLabel, apiKey, fullAddressLabel);
    const imageId = workbook.addImage({
      buffer: mapImageBuffer as any,
      extension: 'png',
    });

    photoSheet.addImage(imageId, {
      tl: { col: 2, row: 16 }, 
      ext: { width: 550, height: 230 },
    });

    // Photo grid settings
    const maxRows = 31;
    const startingRow = 4;
    const photosPerRow = 2;
    const imageWidth = 250;
    const imageHeight = 150;

    // Add report cover photo as actual image instead of hyperlink
    if (reportCoverPhoto && reportCoverPhoto.length > 0) {
      try {
        // ✅ Use new token manager to get downloadable URL
        const downloadUrl = await getOneDriveDownloadUrl(reportCoverPhoto[0]);
        const response = await fetch(downloadUrl);
        const imageBuffer = await response.arrayBuffer();

        const reportCoverImageId = workbook.addImage({
          buffer: Buffer.from(imageBuffer) as any,
          extension: 'png', 
        });

        // Add image to cell C4 position (similar to other photos)
        photoSheet.addImage(reportCoverImageId, {
          tl: { col: 2, row: 3 }, // C4 cell position (col 2 = C, row 3 = 4 in 0-based indexing)
          ext: { width: 300, height: 300 }, // Adjust size as needed
        });
      } catch (error) {
        console.error('Failed to embed report cover photo:', error);
        // Fallback to hyperlink if image embedding fails
        photoSheet.getCell('C4').value = {
          text: "View Report Cover Photo", 
          hyperlink: reportCoverPhoto[0] || ''
        };
      }
    } else {
      // Clear the cell if no photo is available
      photoSheet.getCell('C4').value = '';
    }

    // Process all photos
    const allPhotos: { type: string; url: string }[] = [
      ...exteriorPhotos.map((url: string) => ({ type: 'Exterior', url })),
      ...interiorPhotos.map((url: string) => ({ type: 'Interior', url })),
      ...additionalPhotos.map((url: string) => ({ type: 'Additional', url })),
    ];

    for (let i = 0; i < Math.min(allPhotos.length, maxRows); i++) {
      const rowIndex = Math.floor(i / photosPerRow);
      const colIndex = i % photosPerRow;
      
      const col = 28 + (colIndex * 4);
      const row = 5 + (rowIndex * 8);

      try {
        // ✅ Use new token manager (no manual token needed)
        const downloadUrl = await getOneDriveDownloadUrl(allPhotos[i].url);
        const response = await fetch(downloadUrl);
        const imageBuffer = await response.arrayBuffer();

        const imageId = workbook.addImage({
          buffer: Buffer.from(imageBuffer) as any,
          extension: 'png', 
        });

        photoSheet.addImage(imageId, {
          tl: { col: col, row: row }, 
          ext: { width: imageWidth, height: imageHeight },
        });
      } catch (error) {
        console.error(`Failed to embed image at position ${i}:`, error);
      }
    }
    
    // Clear remaining cells
    for (let i = allPhotos.length; i < maxRows; i++) {
      const row = startingRow + i;
      photoSheet.getCell(`AB${row}`).value = '';
    }

    // 📊 Valuation Summary Sheet
    const valuationSummarySheet = workbook.getWorksheet('Valuation Summary');
    if (!valuationSummarySheet) {
      throw new Error('Valuation sheet not found in template');
    }

    // Generate and add map image for valuation summary
    const mapImageBuffer1 = await generateCustomMapImage(fullAddressLabel, apiKey, fullAddressLabel);
    const imageId1 = workbook.addImage({
      buffer: mapImageBuffer1 as any,
      extension: 'png',
    });

    valuationSummarySheet.addImage(imageId1, {
      tl: { col: 29, row: 13 }, 
      ext: { width: 550, height: 200 },
    });

    // ✨ Valuation Summary photos - FIXED positioning
    const maxRows1 = 31;
    const photosPerRow1 = 2;
    const imageWidth1 = 180; // Reduced size to fit better
    const imageHeight1 = 90;  // Reduced size to fit better

    const allPhotos1: { type: string; url: string }[] = [
      ...exteriorPhotos.map((url: string) => ({ type: 'Exterior', url })),
      ...interiorPhotos.map((url: string) => ({ type: 'Interior', url })),
      ...additionalPhotos.map((url: string) => ({ type: 'Additional', url })),
    ];

    for (let i = 0; i < Math.min(allPhotos1.length, maxRows1); i++) {
      const rowIndex = Math.floor(i / photosPerRow1);
      const colIndex = i % photosPerRow1;
      
      // ✅ FIXED: Better positioning to stay within page bounds
      const col = 119 + (colIndex * 3); // More conservative starting position
      const row = 7 + (rowIndex * 5);   // Tighter vertical spacing

      try {
        // ✅ Use new token manager
        const downloadUrl = await getOneDriveDownloadUrl(allPhotos1[i].url);
        const response = await fetch(downloadUrl);
        const imageBuffer = await response.arrayBuffer();

        const imageId = workbook.addImage({
          buffer: Buffer.from(imageBuffer) as any,
          extension: 'png', 
        });

        valuationSummarySheet.addImage(imageId, {
          tl: { col: col, row: row }, 
          ext: { width: imageWidth1, height: imageHeight1 },
        });
      } catch (error) {
        console.error(`Failed to embed valuation summary image at position ${i}:`, error);
      }
    }

    // Clear remaining cells in valuation summary
    for (let i = allPhotos1.length; i < maxRows1; i++) {
      const row = startingRow + i;
      valuationSummarySheet.getCell(`DO${row}`).value = '';
    }

    // 📋 Report Cover Sheet
    const reportOverviewSheet = workbook.getWorksheet('Report Cover');
    if (!reportOverviewSheet) {
      throw new Error('Report Cover sheet not found in template');
    }

    if (reportCoverPhoto && reportCoverPhoto.length > 0) {
      try {
        // ✅ Use new token manager to get downloadable URL
        const downloadUrl = await getOneDriveDownloadUrl(reportCoverPhoto[0]);
        const response = await fetch(downloadUrl);
        const imageBuffer = await response.arrayBuffer();

        const reportCoverImageId = workbook.addImage({
          buffer: Buffer.from(imageBuffer) as any,
          extension: 'png', 
        });

        // Add image to Report Cover sheet
        reportOverviewSheet.addImage(reportCoverImageId, {
          tl: { col: 15, row: 7 }, 
          ext: { width: 300, height: 300 }, // Adjust size as needed
        });
      } catch (error) {
        console.error('Failed to embed report cover photo:', error);
        // Fallback to hyperlink if image embedding fails
        reportOverviewSheet.getCell('Q13').value = {
          text: "View Report Cover Photo", 
          hyperlink: reportCoverPhoto[0] || ''
        };
      }
    } else {
      // Clear the cell if no photo is available
      reportOverviewSheet.getCell('Q13').value = '';
    }

    // ✅ Save Excel file to temp directory first
    // ✅ Save Excel file to temp directory with proper handling
    const tempExcelPath = path.join(os.tmpdir(), `${id}-valuation-report-${Date.now()}.xlsx`);
    
    // Ensure the temp directory exists and is writable
    const tempDir = path.dirname(tempExcelPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write the Excel file with proper error handling
    try {
      const buffer = await workbook.xlsx.writeBuffer() as any;

      // Save buffer to file
      fs.writeFileSync(tempExcelPath, buffer);
      
      // Wait a bit for file system to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the file was written correctly
      if (!fs.existsSync(tempExcelPath)) {
        throw new Error('Excel file was not created');
      }
      
      const excelStats = fs.statSync(tempExcelPath);
      console.log(`Excel file created: ${tempExcelPath}, size: ${excelStats.size} bytes`);
      
      if (excelStats.size === 0) {
        throw new Error('Generated Excel file is empty');
      }

      // Set file permissions to ensure Excel can access it
      try {
        fs.chmodSync(tempExcelPath, 0o666); // Read/write for all users
        console.log('File permissions set successfully');
      } catch (chmodError) {
        console.warn('Could not set file permissions (this is usually fine on Windows):', chmodError);
      }

    } catch (writeError) {
      console.error('Failed to write Excel file:', writeError);
      if (writeError instanceof Error) {
        throw new Error(`Failed to create Excel file: ${writeError.message}`);
      } else {
        throw new Error('Failed to create Excel file: Unknown error');
      }
    }

    const buffer = fs.readFileSync(tempExcelPath);
    const file = {
      buffer,
      originalname: `Valuation-Report-${id}.xlsx`,
    };

    // Upload Excel to OneDrive
    const oneDriveUrl = await uploadToOneDrive(file, id, 'Valuation-Report');
    const downloadBase64 = buffer.toString('base64');

    // ✅ Generate PDF using Win32 method with improved error handling
    let pdfBuffer: Buffer;
    let pdfUrl: string = '';
    let pdfGenerated: boolean = false;

    try {
      // Check if running on Windows
      if (process.platform === 'win32') {
        console.log('Using Win32 PDF generation...');
        console.log(`Source Excel file: ${tempExcelPath}`);
        
        // ✅ Additional validation - try to re-open the Excel file with ExcelJS
        try {
          const testWorkbook = new ExcelJS.Workbook();
          await testWorkbook.xlsx.readFile(tempExcelPath);
          console.log('Excel file validation passed');
          
          // List available worksheets for debugging
          testWorkbook.eachSheet((worksheet, sheetId) => {
            console.log(`Available sheet: "${worksheet.name}" (ID: ${sheetId})`);
          });
          
          // Close the test workbook properly
          testWorkbook.removeWorksheet(testWorkbook.worksheets[0]?.id);
          
        } catch (validationError) {
          throw new Error(`Excel file validation failed: ${validationError}`);
        }
        
        // Wait a bit more for any file locks to clear
        console.log('Waiting for file system to settle...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate PDF with only specific sheets
        pdfBuffer = await generatePDFUsingWin32(
          tempExcelPath, 
          '', 
          ['Valuation Summary', 'Report Cover']
        );
        
        console.log('Win32 PDF generated successfully');

        // Upload PDF to OneDrive
        const pdfFile = {
          buffer: pdfBuffer,
          originalname: `Valuation-Report-${id}.pdf`,
        };

        pdfUrl = await uploadToOneDrive(pdfFile, id, 'Valuation-PDF');
        pdfGenerated = true;
        console.log('PDF uploaded to OneDrive successfully');

      } else {
        console.log('Non-Windows system detected, skipping PDF generation...');
        console.log('Win32 PDF generation only works on Windows with Microsoft Office installed');
      }

    } catch (pdfError: any) {
      console.error('PDF generation failed:', pdfError);
      console.log('Error details:', {
        message: pdfError.message,
        stack: pdfError.stack,
        platform: process.platform,
        excelFileExists: fs.existsSync(tempExcelPath),
        excelFileSize: fs.existsSync(tempExcelPath) ? fs.statSync(tempExcelPath).size : 0,
        tempPath: tempExcelPath
      });
      
      // ✅ Continue without PDF if generation fails
      console.log('Continuing without PDF generation...');
      pdfUrl = ''; 
      pdfGenerated = false;
    }

    // ✅ Clean up temporary Excel file
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
        console.log('Temporary Excel file cleaned up');
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp Excel file:', cleanupError);
    }

    // ✅ Return response with PDF status
    return NextResponse.json({
      success: true,
      reportUrl: oneDriveUrl,
      pdfUrl: pdfUrl, // Will be empty string if PDF generation failed
      download: downloadBase64,
      filename: `Valuation-Report-${id}.xlsx`,
      pdfGenerated: pdfGenerated, // ✅ Indicate if PDF was generated
      platform: process.platform, // ✅ For debugging
      message: pdfGenerated 
        ? 'Excel and PDF reports generated successfully' 
        : 'Excel report generated successfully. PDF generation skipped (Windows with Office required).'
    });

  } catch (err: any) {
    console.error('Excel Report Error:', err);
    
    // ✅ Enhanced error handling for different error types
    if (err.message.includes('token') || err.message.includes('401') || err.message.includes('Authentication')) {
      return NextResponse.json({ 
        error: 'Authentication failed. Please check OneDrive configuration.', 
        message: err.message,
        suggestion: 'Try running the setup script again or check your environment variables.'
      }, { status: 401 });
    }
    
    if (err.message.includes('Template') || err.message.includes('sheet not found')) {
      return NextResponse.json({ 
        error: 'Template file error', 
        message: err.message,
        suggestion: 'Ensure the Excel template file exists and has the required sheets.'
      }, { status: 400 });
    }
    
    if (err.message.includes('Property not found')) {
      return NextResponse.json({ 
        error: 'Property not found', 
        message: err.message 
      }, { status: 404 });
    }

    // ✅ PDF-specific error handling
    if (err.message.includes('Win32') || err.message.includes('PowerShell')) {
      return NextResponse.json({ 
        error: 'PDF generation failed', 
        message: err.message,
        suggestion: 'Ensure you are running on Windows with Microsoft Office installed, or disable PDF generation.',
        excelGenerated: true // Excel was still generated successfully
      }, { status: 200 }); // Still return success since Excel was generated
    }
    
    return NextResponse.json({ 
      error: 'Failed to generate report', 
      message: err.message 
    }, { status: 500 });
  }
}