;;To run type "lein ring server" in terminal.
;;Runs on http://localhost:3000/
;;Cheshire for json encoding https://github.com/dakrone/cheshire
(ns clojureVision.handler
  (:require [compojure.core :refer :all]
            [compojure.route :as route]
            [clojure.string :as str]
            [cheshire.core :refer :all]
            [ring.util.response :as resp]
            [clj-http.client :as client]
            [ring.middleware.defaults :refer :all]
            [ring.middleware.json :refer [wrap-json-body]]
            [ring.middleware.session :refer [wrap-session]]
            [ring.middleware.anti-forgery :refer :all]
            [ring.middleware.session.cookie :refer (cookie-store)]))
(require '[clojure.java.jdbc :as j])
(def getApiKey (slurp "resources/apiKey.txt"))
(def default-users
  {"annie1" {:first-name "Annie"
             :last-name "Leonhart"
             :quote "Warrior to the core"}
   "OgEren" {:first-name "Eren"
             :last-name "Kruger"
             :quote "Owlman"}
   "AdvancingTitan" {:first-name "Eren"
                     :last-name "Yeager"
                     :quote "Gotta keep advancing"}
   "Armin" {:first-name "Armin"
            :last-name "Arlet"
            :quote "Collosal Gains"}})

(defn getUserName [char]
  (str (:first-name char) " " (:last-name char)));;Returns every users file with on the same first-name

(defn encodeNameList [user-list]
  (if (empty? user-list)
    (generate-string "No names found.")
    (generate-string {:names (map getUserName user-list)})))

;;Prints the full names from a sequence
(defn printUserList [user-list]
  (for [user user-list]
    (prn (getUserName user) "\n")))

(defn getUsersByName
  ([first-name] (let [user-id (keys default-users) user-data (vals default-users)]
                  (filter (fn [user]
                            (when
                             (= (:first-name user) first-name)
                              user))
                          user-data)))
  ([first-name last-name] (let [user-id (keys default-users) user-data (vals default-users)]
                            (filter (fn [user]
                                      (when
                                       (and (= (:first-name user) first-name)
                                            (= (:last-name user) last-name))
                                        user))
                                    user-data))))

(defn printCharName
  ([]  (getUserName (rand-nth (vals default-users))))
  ([first-name]  (encodeNameList (getUsersByName first-name)))
  ([first-name last-name]  (encodeNameList (getUsersByName first-name last-name))))

(def image-content-types-exceptions {"jpg" "jpeg"})
(def text-content-types-exceptions {"js" "javascript"
                                    "txt" "plain"})

(defn checkTypeException [content-type type-exception-map]
  (let [type-exception (get type-exception-map content-type)]
    (if type-exception type-exception content-type)))

(defn returnFile
  ([path full-content-type]
   (resp/content-type (resp/resource-response path {:root "public"})
                      full-content-type))
  ([path response-type content-type]
   (resp/content-type (resp/resource-response path {:root "public"})
                      (str response-type (if (= response-type "text/")
                                           (checkTypeException content-type text-content-types-exceptions)
                                           (if (= response-type "image/")
                                             (checkTypeException content-type image-content-types-exceptions)
                                             content-type))))))

(defn listContainsString? [collection search-string]
  (some (partial = search-string) collection))
(def labels-mode "labels")
(def text-detection-mode "TEXT_DETECTION")
(def face-detection-mode "FACE_DETECTION")

(defn apiRequest [image-str call-features]
  (let [makeCall (fn [base64-img]
                   (client/post getApiKey
                                {:form-params {:requests [{:image {:content base64-img}
                                                           :features call-features}]}
                                 :content-type :json
              ;;:socket-timeout 1000  ;; in milliseconds
              ;;:conn-timeout 1000    ;; in milliseconds
              ;;:accept :json
}
                                (fn [response]
                                  (do
                                    (prn getApiKey)
                                    (prn response)
                                    response))
                                (fn [exception]
                                  (do
                                    (prn getApiKey)
                                    (prn exception)
                                    exception))))]
    (if (str/starts-with? image-str "data:image/png;base64,")
      (do
        ;;(prn (subs image-str (count "data:image/png;base64,")))
        (makeCall (subs image-str (count "data:image/png;base64,"))))
      (makeCall image-str))))

(defn parseImageLabels ([image-str max-results]
                        (let [call-features [{"type" "LABEL_DETECTION"
                                              "maxResults" max-results}]] (apiRequest image-str call-features))))
(defn parseImageText ([image-str max-results]
                      (let [call-features [{"type" "TEXT_DETECTION"
                                            "maxResults" max-results}]] (apiRequest image-str call-features))))
(defn parseFace [image-str max-results]
  (let [call-features [{"type" "FACE_DETECTION"
                        "maxResults" max-results}]] (apiRequest image-str call-features)))

(defroutes app-routes
           (GET "/" []
                (returnFile "scripts/index.html" "text/html"))
           (GET "/session" [] (generate-string {:csrf-token
                                                *anti-forgery-token*}))
           (GET "/images/:file-name.:extension" [file-name extension]
                (returnFile (str "images/" file-name "." extension) "image/" extension))
           (GET "/index" []
                (returnFile "scripts/index.html" "text/html"))
           (GET "/:file-name.:extension" [file-name extension]
                (returnFile (str "scripts/" file-name "." extension) "text/" extension))
           (GET "/random-char" [] (printCharName))

           ;;http://localhost:3000/users/Armin
           (GET "/users/:first-name" [first-name last-name]
                (if last-name
                  (printCharName first-name last-name)
                  (printCharName first-name)))
           (route/resources "/")
           (route/not-found "Not Found"))
(defroutes api-routes (POST "/vision" request
                            (let [body (:body request)
                                  mode (:mode body)
                                  image-str (:image body)]
                              (do
                                (print "mode: " mode)
                                (if (= mode labels-mode) (parseImageLabels image-str 1)
                                    (if (= mode face-detection-mode)
                                      (parseFace image-str 1)
                                      (if (= mode text-detection-mode)
                                        (parseImageText image-str 1)
                                        {:status 400
                                         :body "Invalid Mode"})))))))

(def app
  (routes (wrap-json-body api-routes {:keywords? true})
          (wrap-defaults app-routes site-defaults)))
