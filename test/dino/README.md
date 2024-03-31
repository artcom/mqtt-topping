mac
curl --location --request POST 'http://localhost:8080/query' \
--header 'Content-Type: application/json' \
--data-raw '{"topic":"my","depth":1}'

win powershell
curl --location --request POST "http://localhost:8080/query" --header "Content-Type: application/json" --data-raw '{\"topic\":\"my\",\"depth\":1}'

postmnan

Using Postman to make a POST request is a straightforward way to test your HTTP server endpoints without worrying about the command line's intricacies. Here's how you can do it, based on your requirement to query { topic: "my", depth: 1 }:

1. Open Postman

If you haven't already, download and install Postman from the official website. Launch Postman once installed. 2. Create a New Request

    Click on the New button in the upper left corner, then select Request from the menu that appears.
    A dialog will pop up asking for details about the new request. You can name your request and optionally create a collection to organize your requests. After filling in the details, click Save to... and choose your collection or create a new one.

3. Configure the Request

   HTTP Method: At the left of the URL bar, there's a dropdown menu where you can select the HTTP method. Choose POST from the list.
   Request URL: Enter the URL of your HTTP server's query endpoint in the URL bar. Based on your description, this will be http://localhost:8080/query.
   Headers: Go to the Headers tab just below the URL bar. Add a new header where the key is Content-Type and the value is application/json. This header tells the server that you're sending JSON data in your request body.
   Body: Click on the Body tab, select the raw option, and from the dropdown menu that initially says Text, change it to JSON. In the text field that becomes editable, enter the JSON data for your request:

   json

   {
   "topic": "my",
   "depth": 1
   }

4. Send the Request

After configuring your request, click the Send button. Postman will make the POST request to your server with the specified body and headers. 5. Review the Response

The response from your server will be displayed in the lower section of the Postman interface. Here, you can review the status code, response time, and the body of the response. This will let you know if your server handled the query as expected or if there were any issues.

Using Postman for testing your endpoints is highly beneficial, especially for complex requests or when debugging. It provides a user-friendly interface and allows you to easily organize, save, and share your requests.\

{
"topic": "test/topping-0.008748571708351305/more",
"depth": 1
}
